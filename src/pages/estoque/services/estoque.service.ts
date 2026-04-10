import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];
export type EstoqueMovimentoRow = Database["public"]["Tables"]["estoque_movimentos"]["Row"];
export type EstoqueMovimentoInsert =
  Database["public"]["Tables"]["estoque_movimentos"]["Insert"];

export interface EstoqueMovimento extends EstoqueMovimentoRow {
  produtos?: { nome: string; sku: string | null } | null;
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
