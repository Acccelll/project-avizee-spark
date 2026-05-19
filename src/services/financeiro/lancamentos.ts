import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LancamentoInsert =
  Database["public"]["Tables"]["financeiro_lancamentos"]["Insert"];

/**
 * Insert simples em `financeiro_lancamentos`.
 *
 * Para fluxos transacionais (parcelamento, baixa, estorno) use os
 * RPCs/serviços dedicados (`gerarParcelas`, `processarBaixaLote`, etc).
 * Esta função cobre apenas o lançamento manual avulso.
 */
export async function createLancamento(payload: LancamentoInsert): Promise<void> {
  const { error } = await supabase
    .from("financeiro_lancamentos")
    .insert({ ativo: true, ...payload });
  if (error) throw new Error(error.message);
}

/**
 * Edição privilegiada de UM lançamento (admin/financeiro). Aciona a RPC
 * `editar_lancamento_financeiro_admin` que valida o papel, estorna baixas
 * automaticamente se valor/forma/cartao/vencimento mudarem, re-resolve
 * fatura de cartão e grava em `auditoria_logs`.
 *
 * - `motivo` é obrigatório (≥ 10 caracteres).
 * - `payload` deve conter apenas as chaves a alterar (merge no servidor).
 */
export interface EditarLancamentoAdminResult {
  lancamento_id: string;
  baixas_estornadas: number;
  status: string;
}
export async function editarLancamentoAdmin(
  id: string,
  payload: Record<string, unknown>,
  motivo: string,
): Promise<EditarLancamentoAdminResult> {
  const { data, error } = await supabase.rpc("editar_lancamento_financeiro_admin", {
    p_id: id,
    p_payload: payload as never,
    p_motivo: motivo,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as EditarLancamentoAdminResult;
}

export interface EditarBaixaAdminResult {
  baixa_antiga_id: string;
  nova_baixa_id: string;
}
export async function editarBaixaAdmin(
  baixaId: string,
  payload: Record<string, unknown>,
  motivo: string,
): Promise<EditarBaixaAdminResult> {
  const { data, error } = await supabase.rpc("editar_baixa_admin", {
    p_baixa_id: baixaId,
    p_payload: payload as never,
    p_motivo: motivo,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as EditarBaixaAdminResult;
}
