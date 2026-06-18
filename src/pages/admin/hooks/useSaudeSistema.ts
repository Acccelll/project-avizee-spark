/**
 * useSaudeSistema — agrega métricas operacionais para o painel "Saúde do sistema".
 *
 * Fontes:
 *  - `v_admin_audit_unified`     → eventos administrativos por entidade (24h / 7d)
 *  - `email_send_log`            → taxa de erro de envio (24h)
 *  - `email_send_state`          → backoff de envio (`retry_after_until`)
 *  - `email_queue_metrics()`     → profundidade das filas pgmq (auth/transactional + DLQ)
 *  - edge function `sefaz-proxy` → ping `action: "health"` para indicar disponibilidade
 *
 * Não cria endpoints novos: tudo lido via PostgREST com RLS (admin-only).
 * O resultado alimenta `<HealthBadge>` e cartões de KPI em `SaudeSistemaSection`.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HealthStatus } from "@/components/HealthBadge";
import {
  fetchAuditEntidades,
  fetchEmailStats,
  fetchWebhookMetrics,
  fetchEmailQueueMetrics,
  type FilaEmailMetric as FilaEmailMetricSvc,
} from "@/services/admin/saudeSistema.service";

export interface ModuloEvento {
  entidade: string;
  eventos24h: number;
  eventos7d: number;
}

export interface IntegracaoSaude {
  chave: "email" | "auditoria" | "permissoes" | "fila_email" | "sefaz" | "webhooks";
  nome: string;
  status: HealthStatus;
  detalhe: string;
}

export interface FilaEmailMetric {
  queue_name: string;
  total_messages: number;
  oldest_msg_age_seconds: number;
}

export interface SaudeSistemaSnapshot {
  geradoEm: string;
  modulos: ModuloEvento[];
  integracoes: IntegracaoSaude[];
  email: {
    enviados24h: number;
    erros24h: number;
    taxaErro: number;
    backoffAte: string | null;
  };
  filas: FilaEmailMetric[];
}

/** Limites para classificação de saúde do envio de e-mail. */
const EMAIL_DEGRADED_THRESHOLD = 0.05; // 5% de erro
const EMAIL_DOWN_THRESHOLD = 0.25;     // 25% de erro

/** Limites para a fila de e-mail (mensagens pendentes acumuladas). */
const FILA_DEGRADED_MSGS = 50;
const FILA_DOWN_MSGS = 200;
/** Idade máxima saudável da mensagem mais antiga (segundos). */
const FILA_DEGRADED_AGE = 15 * 60;     // 15 min
const FILA_DOWN_AGE = 60 * 60;         // 1 h

/** Limites para webhooks. Falhas em 24h e profundidade da fila pgmq. */
const WEBHOOK_FALHAS_DEGRADED = 1;
const WEBHOOK_FALHAS_DOWN = 10;
const WEBHOOK_FILA_DEGRADED = 50;
const WEBHOOK_FILA_DOWN = 200;

function classificarEmail(erros: number, total: number, backoffAte: string | null): IntegracaoSaude {
  if (backoffAte && new Date(backoffAte) > new Date()) {
    return {
      chave: "email",
      nome: "Envio de e-mails",
      status: "down",
      detalhe: `Em backoff até ${new Date(backoffAte).toLocaleString("pt-BR")}`,
    };
  }
  if (total === 0) {
    return {
      chave: "email",
      nome: "Envio de e-mails",
      status: "unknown",
      detalhe: "Nenhum envio nas últimas 24h",
    };
  }
  const taxa = erros / total;
  if (taxa >= EMAIL_DOWN_THRESHOLD) {
    return {
      chave: "email",
      nome: "Envio de e-mails",
      status: "down",
      detalhe: `${erros}/${total} envios com erro (${(taxa * 100).toFixed(1)}%)`,
    };
  }
  if (taxa >= EMAIL_DEGRADED_THRESHOLD) {
    return {
      chave: "email",
      nome: "Envio de e-mails",
      status: "degraded",
      detalhe: `${erros}/${total} envios com erro (${(taxa * 100).toFixed(1)}%)`,
    };
  }
  return {
    chave: "email",
    nome: "Envio de e-mails",
    status: "healthy",
    detalhe: `${total} envios nas últimas 24h, ${erros} com erro`,
  };
}

function classificarFila(filas: FilaEmailMetric[]): IntegracaoSaude {
  // Considera apenas as filas principais (DLQ é tratada à parte no card).
  const main = filas.filter((f) => !f.queue_name.endsWith("_dlq"));
  const dlqTotal = filas
    .filter((f) => f.queue_name.endsWith("_dlq"))
    .reduce((s, f) => s + f.total_messages, 0);
  const totalPend = main.reduce((s, f) => s + f.total_messages, 0);
  const idadeMax = main.reduce((m, f) => Math.max(m, f.oldest_msg_age_seconds), 0);

  if (dlqTotal > 0) {
    return {
      chave: "fila_email",
      nome: "Fila de e-mail",
      status: "down",
      detalhe: `${dlqTotal} mensagem(ns) na DLQ — investigar falhas persistentes`,
    };
  }
  if (totalPend >= FILA_DOWN_MSGS || idadeMax >= FILA_DOWN_AGE) {
    return {
      chave: "fila_email",
      nome: "Fila de e-mail",
      status: "down",
      detalhe: `${totalPend} pendentes, mais antiga há ${Math.round(idadeMax / 60)} min`,
    };
  }
  if (totalPend >= FILA_DEGRADED_MSGS || idadeMax >= FILA_DEGRADED_AGE) {
    return {
      chave: "fila_email",
      nome: "Fila de e-mail",
      status: "degraded",
      detalhe: `${totalPend} pendentes, mais antiga há ${Math.round(idadeMax / 60)} min`,
    };
  }
  if (totalPend === 0) {
    return {
      chave: "fila_email",
      nome: "Fila de e-mail",
      status: "healthy",
      detalhe: "Nenhuma mensagem pendente",
    };
  }
  return {
    chave: "fila_email",
    nome: "Fila de e-mail",
    status: "healthy",
    detalhe: `${totalPend} pendente(s), processamento dentro do SLA`,
  };
}

async function pingSefaz(): Promise<IntegracaoSaude> {
  const inicio = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke("sefaz-proxy", {
      body: { action: "health" },
    });
    const ms = Math.round(performance.now() - inicio);
    if (error) {
      return {
        chave: "sefaz",
        nome: "Proxy Sefaz",
        status: "down",
        detalhe: `Falha na chamada: ${error.message}`,
      };
    }
    const hasPfx = (data as { hasPfxPassword?: boolean } | null)?.hasPfxPassword;
    if (hasPfx === false) {
      return {
        chave: "sefaz",
        nome: "Proxy Sefaz",
        status: "degraded",
        detalhe: `Acessível em ${ms}ms, mas senha do PFX não configurada`,
      };
    }
    return {
      chave: "sefaz",
      nome: "Proxy Sefaz",
      status: "healthy",
      detalhe: `Acessível em ${ms}ms`,
    };
  } catch (e) {
    return {
      chave: "sefaz",
      nome: "Proxy Sefaz",
      status: "down",
      detalhe: `Indisponível: ${(e as Error).message}`,
    };
  }
}

async function classificarWebhooks(): Promise<IntegracaoSaude> {
  try {
    const m = await fetchWebhookMetrics();

    if (m.endpoints_ativos === 0) {
      return {
        chave: "webhooks",
        nome: "Webhooks de saída",
        status: "unknown",
        detalhe: "Nenhum endpoint ativo configurado",
      };
    }
    if (m.falhas_24h >= WEBHOOK_FALHAS_DOWN || m.fila_total >= WEBHOOK_FILA_DOWN) {
      return {
        chave: "webhooks",
        nome: "Webhooks de saída",
        status: "down",
        detalhe: `${m.falhas_24h} falha(s) em 24h, ${m.fila_total} na fila`,
      };
    }
    if (m.falhas_24h >= WEBHOOK_FALHAS_DEGRADED || m.fila_total >= WEBHOOK_FILA_DEGRADED) {
      return {
        chave: "webhooks",
        nome: "Webhooks de saída",
        status: "degraded",
        detalhe: `${m.falhas_24h} falha(s) em 24h, ${m.fila_total} na fila`,
      };
    }
    return {
      chave: "webhooks",
      nome: "Webhooks de saída",
      status: "healthy",
      detalhe: `${m.endpoints_ativos} endpoint(s) ativo(s), ${m.deliveries_pendentes} pendente(s)`,
    };
  } catch (e) {
    return {
      chave: "webhooks",
      nome: "Webhooks de saída",
      status: "unknown",
      detalhe: `Métricas indisponíveis: ${(e as Error).message}`,
    };
  }
}

export function useSaudeSistema() {
  return useQuery({
    queryKey: ["admin", "saude-sistema"] as const,
    queryFn: async (): Promise<SaudeSistemaSnapshot> => {
      const agora = new Date();
      const desde24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const desde7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Eventos administrativos por entidade (24h e 7d)
      const [aud24, aud7] = await Promise.all([
        fetchAuditEntidades(desde24h),
        fetchAuditEntidades(desde7d),
      ]);

      const contar = (rows: { entidade: string | null }[]) => {
        const map = new Map<string, number>();
        for (const r of rows) {
          const k = r.entidade ?? "indefinido";
          map.set(k, (map.get(k) ?? 0) + 1);
        }
        return map;
      };
      const map24 = contar(aud24);
      const map7 = contar(aud7);
      const todasEntidades = new Set<string>([...map24.keys(), ...map7.keys()]);
      const modulos: ModuloEvento[] = Array.from(todasEntidades)
        .map((entidade) => ({
          entidade,
          eventos24h: map24.get(entidade) ?? 0,
          eventos7d: map7.get(entidade) ?? 0,
        }))
        .sort((a, b) => b.eventos7d - a.eventos7d);

      // 2. E-mail: contagem total + falhas em 24h + estado de backoff
      const { enviados24h, erros24h, backoffAte } = await fetchEmailStats(desde24h);

      // 3. Profundidade das filas pgmq (RPC SECURITY DEFINER admin-only)
      let filas: FilaEmailMetric[] = [];
      try {
        filas = (await fetchEmailQueueMetrics()) as unknown as FilaEmailMetric[];
      } catch {
        // RPC pode falhar em ambientes sem pgmq; mantém lista vazia.
        filas = [];
      }

      // 4. Ping ao sefaz-proxy em paralelo com a montagem do snapshot
      const [sefazIntegracao, webhooksIntegracao] = await Promise.all([
        pingSefaz(),
        classificarWebhooks(),
      ]);

      const integracoes: IntegracaoSaude[] = [
        classificarEmail(erros24h, enviados24h, backoffAte),
        classificarFila(filas),
        sefazIntegracao,
        webhooksIntegracao,
        {
          chave: "auditoria",
          nome: "Trilha de auditoria",
          status: (aud24Res.data?.length ?? 0) > 0 ? "healthy" : "unknown",
          detalhe: `${aud24Res.data?.length ?? 0} eventos nas últimas 24h`,
        },
        {
          chave: "permissoes",
          nome: "Mudanças de permissão",
          status: (map7.get("permission") ?? 0) > 0 ? "healthy" : "unknown",
          detalhe: `${map7.get("permission") ?? 0} alterações nos últimos 7 dias`,
        },
      ];

      return {
        geradoEm: agora.toISOString(),
        modulos,
        integracoes,
        email: {
          enviados24h,
          erros24h,
          taxaErro: enviados24h > 0 ? erros24h / enviados24h : 0,
          backoffAte,
        },
        filas,
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}