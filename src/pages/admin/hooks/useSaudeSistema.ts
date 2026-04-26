/**
 * useSaudeSistema — agrega métricas operacionais para o painel "Saúde do sistema".
 *
 * Fontes:
 *  - `v_admin_audit_unified`     → eventos administrativos por entidade (24h / 7d)
 *  - `email_send_log`            → taxa de erro de envio (24h)
 *  - `email_send_state`          → backoff de envio (`retry_after_until`)
 *
 * Não cria endpoints novos: tudo lido via PostgREST com RLS (admin-only).
 * O resultado alimenta `<HealthBadge>` e cartões de KPI em `SaudeSistemaSection`.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HealthStatus } from "@/components/HealthBadge";

export interface ModuloEvento {
  entidade: string;
  eventos24h: number;
  eventos7d: number;
}

export interface IntegracaoSaude {
  chave: "email" | "auditoria" | "permissoes";
  nome: string;
  status: HealthStatus;
  detalhe: string;
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
}

/** Limites para classificação de saúde do envio de e-mail. */
const EMAIL_DEGRADED_THRESHOLD = 0.05; // 5% de erro
const EMAIL_DOWN_THRESHOLD = 0.25;     // 25% de erro

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

export function useSaudeSistema() {
  return useQuery({
    queryKey: ["admin", "saude-sistema"] as const,
    queryFn: async (): Promise<SaudeSistemaSnapshot> => {
      const agora = new Date();
      const desde24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const desde7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Eventos administrativos por entidade (24h e 7d)
      const [aud24Res, aud7Res] = await Promise.all([
        supabase
          .from("v_admin_audit_unified")
          .select("entidade")
          .gte("created_at", desde24h),
        supabase
          .from("v_admin_audit_unified")
          .select("entidade")
          .gte("created_at", desde7d),
      ]);
      if (aud24Res.error) throw aud24Res.error;
      if (aud7Res.error) throw aud7Res.error;

      const contar = (rows: { entidade: string | null }[]) => {
        const map = new Map<string, number>();
        for (const r of rows) {
          const k = r.entidade ?? "indefinido";
          map.set(k, (map.get(k) ?? 0) + 1);
        }
        return map;
      };
      const map24 = contar(aud24Res.data ?? []);
      const map7 = contar(aud7Res.data ?? []);
      const todasEntidades = new Set<string>([...map24.keys(), ...map7.keys()]);
      const modulos: ModuloEvento[] = Array.from(todasEntidades)
        .map((entidade) => ({
          entidade,
          eventos24h: map24.get(entidade) ?? 0,
          eventos7d: map7.get(entidade) ?? 0,
        }))
        .sort((a, b) => b.eventos7d - a.eventos7d);

      // 2. E-mail: contagem total + falhas em 24h + estado de backoff
      const [emailTotalRes, emailErrosRes, stateRes] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", desde24h),
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", desde24h)
          .neq("status", "sent"),
        supabase
          .from("email_send_state")
          .select("retry_after_until")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const enviados24h = emailTotalRes.count ?? 0;
      const erros24h = emailErrosRes.count ?? 0;
      const backoffAte = stateRes.data?.retry_after_until ?? null;

      const integracoes: IntegracaoSaude[] = [
        classificarEmail(erros24h, enviados24h, backoffAte),
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
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}