import { supabase } from "@/integrations/supabase/client";

export interface CancelarPedidoVendaResult {
  id: string;
  numero: string;
  status: string;
}

export interface FaturarPedidoVendaResult {
  nfId: string;
  nfNumero: string;
}

/**
 * RPC transacional `gerar_nf_de_pedido`.
 * Numera NF, copia itens com dados fiscais, atualiza status e registra evento fiscal.
 */
export async function faturarPedido(pedidoId: string): Promise<FaturarPedidoVendaResult> {
  const { data, error } = await supabase.rpc("gerar_nf_de_pedido", { p_pedido_id: pedidoId });
  if (error) throw new Error(error.message);
  const r = data as { nf_id: string; nf_numero: string };
  return { nfId: r.nf_id, nfNumero: r.nf_numero };
}

/**
 * RPC `cancelar_pedido_venda`. Bloqueia se houver NF ativa vinculada.
 */
export async function cancelarPedidoVenda(input: {
  id: string;
  motivo?: string | null;
}): Promise<CancelarPedidoVendaResult> {
  const { data, error } = await supabase.rpc("cancelar_pedido_venda", {
    p_id: input.id,
    p_motivo: input.motivo ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as CancelarPedidoVendaResult;
}

/** Patch operacional do pedido de venda (status, PO, datas, observações). */
export interface PedidoOperacionalPatch {
  status?: string | null;
  po_number?: string | null;
  data_po_cliente?: string | null;
  data_prometida_despacho?: string | null;
  prazo_despacho_dias?: number | null;
  observacoes?: string | null;
}

/**
 * RPC `salvar_pedido_operacional` (SECURITY DEFINER + search_path) — atualiza
 * campos operacionais do pedido com auditoria via trigger único.
 */
export async function salvarPedidoOperacional(
  id: string,
  patch: PedidoOperacionalPatch,
): Promise<void> {
  const { error } = await supabase.rpc("salvar_pedido_operacional", {
    p_id: id,
    p_patch: patch as never,
  });
  if (error) throw new Error(error.message);
}