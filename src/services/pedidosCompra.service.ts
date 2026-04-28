import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PedidoCompraRow = Database["public"]["Tables"]["pedidos_compra"]["Row"] & {
  fornecedores?: { nome_razao_social: string | null; cpf_cnpj: string | null } | null;
};

export type PedidoCompraItemRow =
  Database["public"]["Tables"]["pedidos_compra_itens"]["Row"] & {
    produtos?: { nome: string | null; codigo_interno: string | null } | null;
  };

export interface FornecedorAtivo {
  id: string;
  nome_razao_social: string | null;
  cpf_cnpj: string | null;
}

export interface ProdutoAtivoRow {
  id: string;
  nome: string | null;
  codigo_interno: string | null;
  preco_venda: number | null;
  preco_custo: number | null;
  unidade_medida: string | null;
}

export interface FormaPagamentoRow {
  id: string;
  descricao: string;
}

export interface CotacaoCompraResumo {
  numero: string;
  status: string;
}

/** Detalhe de um pedido de compra para a página de edição. */
export async function getPedidoCompra(id: string): Promise<PedidoCompraRow | null> {
  const { data, error } = await supabase
    .from("pedidos_compra")
    .select("*, fornecedores(nome_razao_social, cpf_cnpj)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PedidoCompraRow | null;
}

export async function listPedidoCompraItens(pedidoId: string): Promise<PedidoCompraItemRow[]> {
  const { data, error } = await supabase
    .from("pedidos_compra_itens")
    .select("*, produtos(nome, codigo_interno)")
    .eq("pedido_compra_id", pedidoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PedidoCompraItemRow[];
}

export async function listFornecedoresAtivos(): Promise<FornecedorAtivo[]> {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome_razao_social, cpf_cnpj")
    .eq("ativo", true)
    .order("nome_razao_social");
  if (error) throw new Error(error.message);
  return (data ?? []) as FornecedorAtivo[];
}

export async function listProdutosAtivos(): Promise<ProdutoAtivoRow[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, codigo_interno, preco_venda, preco_custo, unidade_medida")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProdutoAtivoRow[];
}

export async function listFormasPagamentoAtivas(): Promise<FormaPagamentoRow[]> {
  const { data, error } = await supabase
    .from("formas_pagamento")
    .select("id, descricao")
    .eq("ativo", true)
    .order("descricao");
  if (error) throw new Error(error.message);
  return (data ?? []) as FormaPagamentoRow[];
}

export async function getCotacaoResumoById(cotacaoId: string): Promise<CotacaoCompraResumo | null> {
  const { data, error } = await supabase
    .from("cotacoes_compra")
    .select("numero, status")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CotacaoCompraResumo | null;
}
