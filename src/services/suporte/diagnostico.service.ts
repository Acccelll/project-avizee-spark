import { supabase } from "@/integrations/supabase/client";
import type { SuporteDiagnosticoPayload, SuporteDiagnosticoView } from "./types";

/**
 * Coleta contexto técnico automático e seguro (seção 9 da especificação).
 * Nunca inclui conteúdo digitado pelo usuário, tokens, ou dados de formulário.
 */
export function coletarDiagnosticoAutomatico(): SuporteDiagnosticoPayload {
  return {
    url_relativa: `${window.location.pathname}${window.location.search}`,
    ambiente: import.meta.env.MODE,
    navegador: navigator.userAgent,
    sistema_operacional: navigator.platform || undefined,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    idioma: navigator.language,
    conectividade: navigator.onLine ? "online" : "offline",
  };
}

/**
 * Leitura via RPC `obter_diagnostico_suporte` — campos técnicos sensíveis
 * vêm `null` para quem não é admin (especificação, item III.4).
 */
export async function obterDiagnostico(
  chamadoId: string,
): Promise<SuporteDiagnosticoView | null> {
  const { data, error } = await supabase.rpc("obter_diagnostico_suporte", {
    p_chamado_id: chamadoId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
