import { supabase } from "@/integrations/supabase/client";
import { receberCompra as rpcReceberCompra } from "@/types/rpc";

export interface ReceberCompraItem {
  produto_id: string | null;
  descricao?: string | null;
  quantidade_recebida: number;
  valor_unitario: number;
}

export interface ReceberCompraInput {
  pedidoId: string;
  dataRecebimento: string;
  itens: ReceberCompraItem[];
  observacoes?: string;
}

export interface ReceberCompraResult {
  compra_id: string;
  numero: string;
  status_pedido: "recebido" | "parcialmente_recebido";
  valor_total: number;
}

export async function receberCompra(input: ReceberCompraInput): Promise<ReceberCompraResult> {
  const data = await rpcReceberCompra({
    p_pedido_id: input.pedidoId,
    p_data_recebimento: input.dataRecebimento,
    p_itens: input.itens as unknown as never,
    p_observacoes: input.observacoes ?? null,
  });
  return data as unknown as ReceberCompraResult;
}

export async function estornarRecebimentoCompra(input: {
  compraId: string;
  motivo?: string;
}): Promise<unknown> {
  const { data, error } = await supabase.rpc("estornar_recebimento_compra", {
    p_compra_id: input.compraId,
    p_motivo: input.motivo ?? null,
  });
  if (error) throw error;
  return data;
}

export interface CompraRecebimentoRow {
  id: string;
  numero: string | null;
  data_compra: string | null;
  status: string | null;
  valor_total: number | null;
  ativo: boolean | null;
}

/** Lista recebimentos (compras) ativos vinculados a um pedido de compra. */
export async function listRecebimentosDoPedido(
  pedidoCompraId: string,
): Promise<CompraRecebimentoRow[]> {
  const { data, error } = await supabase
    .from("compras")
    .select("id, numero, data_compra, status, valor_total, ativo")
    .eq("pedido_compra_id", pedidoCompraId)
    .eq("ativo", true)
    .order("data_compra", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompraRecebimentoRow[];
}

/* -------- Pedido de Compra -------- */

export interface SalvarPedidoCompraItem {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface SalvarPedidoCompraHeader {
  fornecedor_id: string;
  data_pedido: string;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  frete_valor: number;
  condicao_pagamento: string | null;
  status: string;
  observacoes: string | null;
  valor_total: number;
}

export interface SalvarPedidoCompraInput {
  id: string;
  header: SalvarPedidoCompraHeader;
  itens: SalvarPedidoCompraItem[];
}

/**
 * Atualiza cabeçalho do pedido + substitui itens via RPC `replace_pedido_compra_itens`.
 */
export async function salvarPedidoCompra({ id, header, itens }: SalvarPedidoCompraInput): Promise<void> {
  const { error: updErr } = await supabase
    .from("pedidos_compra")
    .update(header)
    .eq("id", id);
  if (updErr) throw new Error(updErr.message);

  const { error: rpcErr } = await supabase.rpc("replace_pedido_compra_itens", {
    p_pedido_id: id,
    p_itens: itens as unknown as never,
  });
  if (rpcErr) throw new Error(rpcErr.message);
}

/**
 * Gera Pedido de Compra a partir de uma cotação (RPC transacional).
 */
export interface GerarPedidoCompraInput {
  cotacaoId: string;
  observacoes?: string | null;
}

export interface GerarPedidoCompraResult {
  pedidoId: string;
  pedidoNumero: string;
}

export async function gerarPedidoCompra(input: GerarPedidoCompraInput): Promise<GerarPedidoCompraResult> {
  const { data, error } = await supabase.rpc("gerar_pedido_compra", {
    p_cotacao_id: input.cotacaoId,
    p_observacoes: input.observacoes ?? null,
  });
  if (error) throw new Error(error.message);
  const r = data as { pedido_id: string; pedido_numero: string };
  return { pedidoId: r.pedido_id, pedidoNumero: r.pedido_numero };
}