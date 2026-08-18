import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type NotaFiscalUpdate = Database["public"]["Tables"]["notas_fiscais"]["Update"];
type NotaFiscalInsert = Database["public"]["Tables"]["notas_fiscais"]["Insert"];
type NotaFiscalItemInsert = Database["public"]["Tables"]["notas_fiscais_itens"]["Insert"];
export type TipoDocumentoConfirmavel = "nfe" | "nfse" | "cte" | "cte_os" | null | undefined;

export async function cancelarNotaFiscal(nfId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal", { p_nf_id: nfId, p_motivo: motivo });
  if (error) throw error;
}

export async function cancelarNotaFiscalSefaz(nfId: string, protocolo: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal_sefaz", { p_nf_id: nfId, p_protocolo: protocolo, p_motivo: motivo });
  if (error) throw error;
}

export async function inutilizarNotaFiscal(nfId: string, protocolo: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("inutilizar_nota_fiscal", { p_nf_id: nfId, p_protocolo: protocolo, p_motivo: motivo });
  if (error) throw error;
}

export async function confirmarNotaFiscal(nfId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_nota_fiscal", { p_nf_id: nfId });
  if (error) throw error;
}

export async function confirmarNfse(nfId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_nfse", { p_nota_id: nfId });
  if (error) throw error;
}

export async function confirmarCte(nfId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_cte", { p_nota_id: nfId });
  if (error) throw error;
}

export function isDocumentoServico(tipo: TipoDocumentoConfirmavel): boolean {
  return tipo === "nfse" || tipo === "cte" || tipo === "cte_os";
}

export async function confirmarDocumentoFiscal(nfId: string, tipo: TipoDocumentoConfirmavel): Promise<void> {
  if (tipo === "nfse") return confirmarNfse(nfId);
  if (tipo === "cte" || tipo === "cte_os") return confirmarCte(nfId);
  return confirmarNotaFiscal(nfId);
}

export async function estornarNotaFiscal(input: { nfId: string; motivo?: string }): Promise<void> {
  const { error } = await supabase.rpc("estornar_nota_fiscal", { p_nf_id: input.nfId, p_motivo: input.motivo });
  if (error) throw error;
}

export interface ItemDevolucao { produto_id: string; quantidade: number; }
export async function gerarDevolucaoNotaFiscal(input: { nfOrigemId: string; itens?: ItemDevolucao[] }): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_devolucao_nota_fiscal", {
    p_nf_origem_id: input.nfOrigemId,
    p_itens: (input.itens ?? null) as never,
  });
  if (error) throw error;
  return data as string;
}

/** Salva cabeçalho, itens e metadados CT-e/NFS-e na mesma transação. */
export async function upsertNotaFiscalComItens(params: {
  mode: "create" | "edit";
  nfId?: string;
  payload: NotaFiscalInsert & NotaFiscalUpdate;
  itemsBuilder: (nfId: string) => NotaFiscalItemInsert[];
}): Promise<string> {
  const { mode, nfId, payload, itemsBuilder } = params;
  if (mode === "edit" && !nfId) throw new Error("nfId obrigatório para edit");
  const placeholderId = nfId ?? "00000000-0000-0000-0000-000000000000";
  const itensRaw = itemsBuilder(placeholderId);
  const itensPayload = itensRaw.map(({ nota_fiscal_id: _ignored, ...rest }) => rest);
  const { data, error } = await supabase.rpc("salvar_documento_fiscal_completo" as never, {
    p_nf_id: mode === "edit" ? nfId : null,
    p_payload: payload as unknown as Json,
    p_itens: itensPayload as unknown as Json,
  } as never);
  if (error) throw error;
  if (!data) throw new Error("RPC salvar_documento_fiscal_completo não retornou id");
  return data as string;
}

export async function listarRetencoesNfse(notaId: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc("listar_nfse_retencoes" as never, { p_nota_id: notaId } as never);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function listarReferenciasCte(cteId: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc("listar_cte_referencias" as never, { p_cte_id: cteId } as never);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function sincronizarReferenciasCte(cteId: string): Promise<void> {
  const { error } = await supabase.rpc("sincronizar_cte_nfe_referencias" as never, { p_cte_id: cteId } as never);
  if (error) throw error;
}

export async function vincularNFPedidoCompra(input: { notaFiscalId: string; pedidoCompraId: string }): Promise<void> {
  const { error } = await supabase.rpc("vincular_nf_pedido_compra", { p_nf_id: input.notaFiscalId, p_pedido_id: input.pedidoCompraId });
  if (error) throw error;
}

export async function desvincularNFPedidoCompra(notaFiscalId: string): Promise<void> {
  const { error } = await supabase.from("notas_fiscais").update({ pedido_compra_id: null }).eq("id", notaFiscalId);
  if (error) throw error;
}

export interface DuplicataNfe { numero: string; vencimento: string; valor: number; }
export async function gerarFinanceiroNfeEntrada(notaId: string, duplicatas: DuplicataNfe[], formaPagamento: string, cartaoId: string | null): Promise<void> {
  const { error } = await supabase.rpc("gerar_financeiro_nfe_entrada", {
    p_nota_id: notaId, p_duplicatas: duplicatas as unknown as Json, p_forma_pagamento: formaPagamento, p_cartao_id: cartaoId,
  } as never);
  if (error) throw error;
}

export async function gerarFinanceiroNfeSaida(notaId: string, duplicatas: DuplicataNfe[], formaPagamento: string): Promise<void> {
  const { error } = await supabase.rpc("gerar_financeiro_nfe_saida", {
    p_nota_id: notaId, p_duplicatas: duplicatas as unknown as Json, p_forma_pagamento: formaPagamento,
  } as never);
  if (error) throw error;
}

export interface ParcelaFiscal { numero: number; vencimento: string; valor: number; }
export interface AtualizarFinanceiroNotaParams { notaId: string; formaPagamento: string; condicaoPagamento: string; parcelas: ParcelaFiscal[]; }
export async function atualizarFinanceiroNota(params: AtualizarFinanceiroNotaParams): Promise<void> {
  const { error } = await supabase.rpc("atualizar_financeiro_nota", {
    p_nota_id: params.notaId, p_forma_pagamento: params.formaPagamento,
    p_condicao_pagamento: params.condicaoPagamento, p_parcelas: params.parcelas as unknown as Json,
  } as never);
  if (error) throw error;
}
