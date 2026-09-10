/**
 * Coleta de contexto técnico automático para chamados de suporte.
 *
 * Regra dura (spec §11.2, §37): NUNCA capturar senha, token, header
 * Authorization, cookies, XML/payload completo ou dado bancário. Este
 * módulo só lê informação de ambiente do próprio navegador (URL relativa,
 * user agent, viewport, idioma, conectividade) e, quando fornecido pelo
 * chamador, um erro já tratado (mensagem amigável + metadados). Nunca lê
 * `localStorage`/`sessionStorage`/cookies nem inspeciona requisições de rede.
 */
import type { DiagnosticoContexto } from "@/services/suporte.service";

export interface ErroCapturado {
  codigo?: string;
  operacao?: string;
  mensagemAmigavel?: string;
  correlationId?: string;
  httpStatus?: number;
  stackTrace?: string;
}

interface ColetarDiagnosticoOptions {
  /** Contexto livre da tela atual (aba ativa, filtros, período…) — cada tela decide o que faz sentido informar. */
  contextoTela?: Record<string, unknown>;
  erro?: ErroCapturado;
}

interface NetworkInformationLike {
  effectiveType?: string;
}

/** Descrição curta de conectividade — sem qualquer dado de requisição. */
function descreverConectividade(): string {
  if (typeof navigator === "undefined") return "desconhecida";
  if (!navigator.onLine) return "offline";
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return conn?.effectiveType ? `online (${conn.effectiveType})` : "online";
}

/**
 * Monta o objeto `diagnostico` enviado a `criar_chamado_suporte`. Chame no
 * momento do envio do formulário (nunca em background) — o buffer de
 * "erros recentes" é intencionalmente não implementado aqui: cada chamador
 * que já capturou um erro tratado passa `opts.erro` explicitamente.
 */
export function coletarDiagnostico(opts: ColetarDiagnosticoOptions = {}): DiagnosticoContexto {
  const diagnostico: DiagnosticoContexto = {
    url_relativa: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
    ambiente: import.meta.env.MODE,
    navegador: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    sistema_operacional: typeof navigator !== "undefined" ? navigator.platform : undefined,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    idioma: typeof navigator !== "undefined" ? navigator.language : undefined,
    conectividade: descreverConectividade(),
    contexto_tela: opts.contextoTela,
  };

  if (opts.erro) {
    diagnostico.erro_codigo = opts.erro.codigo;
    diagnostico.erro_operacao = opts.erro.operacao;
    diagnostico.erro_mensagem_amigavel = opts.erro.mensagemAmigavel;
    diagnostico.erro_correlation_id = opts.erro.correlationId;
    diagnostico.erro_http_status = opts.erro.httpStatus;
    diagnostico.erro_stack_trace = opts.erro.stackTrace;
  }

  return diagnostico;
}
