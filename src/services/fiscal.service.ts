/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase update type workaround */
import { supabase } from "@/integrations/supabase/client";

// ── Event logging ──────────────────────────────────────────────────────────────

export async function registrarEventoFiscal(params: {
  nota_fiscal_id: string;
  tipo_evento: string;
  status_anterior?: string;
  status_novo?: string;
  descricao?: string;
  payload_resumido?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("nota_fiscal_eventos").insert({
    nota_fiscal_id: params.nota_fiscal_id,
    tipo_evento: params.tipo_evento,
    status_anterior: params.status_anterior || null,
    status_novo: params.status_novo || null,
    descricao: params.descricao || null,
    payload_resumido: params.payload_resumido || null,
    usuario_id: user?.id || null,
  } as any);
}

/**
 * Cancelamento interno da NF (status_sefaz != autorizada).
 * Estorna efeitos automaticamente quando NF estava confirmada.
 * Para NF autorizada na SEFAZ, use `cancelarNotaFiscalSefaz`.
 */
export async function cancelarNotaFiscal(nfId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal" as never, {
    p_nf_id: nfId,
    p_motivo: motivo,
  } as never);
  if (error) throw error;
}

/**
 * Cancelamento via SEFAZ (somente NFs autorizadas).
 * Atualiza status_sefaz para `cancelada_sefaz` preservando integridade contábil.
 */
export async function cancelarNotaFiscalSefaz(
  nfId: string,
  protocolo: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal_sefaz" as never, {
    p_nf_id: nfId,
    p_protocolo: protocolo,
    p_motivo: motivo,
  } as never);
  if (error) throw error;
}

/**
 * Inutilização de faixa numérica (somente status_sefaz=nao_enviada e
 * status interno em rascunho/cancelada).
 */
export async function inutilizarNotaFiscal(
  nfId: string,
  protocolo: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc("inutilizar_nota_fiscal" as never, {
    p_nf_id: nfId,
    p_protocolo: protocolo,
    p_motivo: motivo,
  } as never);
  if (error) throw error;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
//
// As funções `confirmarNotaFiscal`, `estornarNotaFiscal` e `processarDevolucao`
// foram removidas na Fase 9 do roadmap fiscal. A orquestração manual de estoque,
// financeiro e faturamento foi substituída por RPCs atômicas server-side.
// Use os hooks canônicos:
//   - useConfirmarNotaFiscal   (RPC `confirmar_nota_fiscal`)
//   - useEstornarNotaFiscal    (RPC `estornar_nota_fiscal`)
//   - useGerarDevolucaoNF      (RPC `gerar_devolucao_nota_fiscal`)
// em `src/pages/fiscal/hooks/useNotaFiscalLifecycle.ts`.

/** Re-exported from `@/lib/fiscal` for backward compatibility. */
export { calcularCfopDevolucao } from "@/lib/fiscal";

// ── Duplicate check ────────────────────────────────────────────────────────────

export async function verificarDuplicidadeChave(
  chaveAcesso: string
): Promise<boolean> {
  if (!chaveAcesso || chaveAcesso.length < 44) return false;
  const { data } = await supabase
    .from("notas_fiscais")
    .select("id")
    .eq("chave_acesso", chaveAcesso)
    .limit(1);
  return (data?.length || 0) > 0;
}
