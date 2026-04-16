import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];
export type EstoqueMovimentoRow = Database["public"]["Tables"]["estoque_movimentos"]["Row"];
export type EstoqueMovimentoInsert =
  Database["public"]["Tables"]["estoque_movimentos"]["Insert"];

export interface EstoqueMovimento extends EstoqueMovimentoRow {
  produtos?: { nome: string; sku: string | null } | null;
}

/** Simplified shape returned by the vw_estoque_posicao view. */
export interface EstoquePosicaoRow {
  produto_id: string;
  produto_nome: string;
  sku: string | null;
  codigo_interno: string | null;
  unidade_medida: string | null;
  estoque_minimo: number | null;
  preco_venda: number | null;
  ativo: boolean;
  estoque_atual: number;
  estoque_reservado: number;
}

export async function fetchProdutosEstoque(): Promise<ProdutoRow[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Fetches the aggregated stock position from the `vw_estoque_posicao` Supabase
 * view (see migration 20260411052000_create_vw_estoque_posicao.sql).
 *
 * The view consolidates saldo_atual and estoque_reservado per product so that
 * the frontend does not need to perform client-side aggregation.
 */
/**
 * Typed accessor for Supabase DB views not present in generated types.
 * Returns a standard query builder so `.select()`, `.order()`, etc. work.
 */
function fromView(viewName: string) {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> })
    .from(viewName);
}

export async function fetchEstoquePosicao(): Promise<EstoquePosicaoRow[]> {
  const { data, error } = await fromView("vw_estoque_posicao")
    .select("*")
    .order("produto_nome");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EstoquePosicaoRow[];
}

export async function fetchMovimentacoes(): Promise<EstoqueMovimento[]> {
  const { data, error } = await supabase
    .from("estoque_movimentos")
    .select("*, produtos(nome, sku)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EstoqueMovimento[];
}

export async function fetchMovimentacoesPorProduto(
  produtoId: string,
): Promise<EstoqueMovimento[]> {
  const { data, error } = await supabase
    .from("estoque_movimentos")
    .select("*, produtos(nome, sku)")
    .eq("produto_id", produtoId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EstoqueMovimento[];
}

export async function registrarMovimentacao(
  payload: EstoqueMovimentoInsert,
  novoEstoqueAtual: number,
): Promise<void> {
  const { error: movError } = await supabase
    .from("estoque_movimentos")
    .insert(payload);

  if (movError) throw new Error(movError.message);

  const { error: prodError } = await supabase
    .from("produtos")
    .update({ estoque_atual: novoEstoqueAtual })
    .eq("id", payload.produto_id);

  if (prodError) throw new Error(prodError.message);
}
