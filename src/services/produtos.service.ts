import { supabase } from "@/integrations/supabase/client";

/**
 * Service centralizando consultas usadas por `Produtos.tsx`.
 * RPCs `save_produto_composicao` e `save_produto_fornecedores` são atômicas
 * server-side e ficam encapsuladas aqui para evitar queries diretas na UI.
 */

export async function listGruposAtivos() {
  const { data, error } = await supabase
    .from("grupos_produto")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data || [];
}

export async function listFornecedoresParaProduto() {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome_razao_social")
    .eq("ativo", true)
    .order("nome_razao_social");
  if (error) throw error;
  return data || [];
}

export async function listUnidadesMedidaAtivas() {
  const { data, error } = await supabase
    .from("unidades_medida")
    .select("id, codigo, descricao, sigla")
    .eq("ativo", true)
    .order("codigo");
  if (error) throw error;
  return data || [];
}

export async function createUnidadeMedida(input: {
  codigo: string;
  descricao: string;
  sigla: string | null;
}) {
  const { data, error } = await supabase
    .from("unidades_medida")
    .insert({ ...input, ativo: true })
    .select("id, codigo, descricao, sigla")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProdutoComposicaoRow = {
  id: string;
  produto_filho_id: string;
  quantidade: number;
  ordem: number;
  produtos: { nome: string; sku: string; preco_custo: number } | null;
};

export async function listProdutoComposicao(produtoPaiId: string): Promise<ProdutoComposicaoRow[]> {
  const { data, error } = await supabase
    .from("produto_composicoes")
    .select("id, produto_filho_id, quantidade, ordem, produtos:produto_filho_id(nome, sku, preco_custo)")
    .eq("produto_pai_id", produtoPaiId)
    .order("ordem");
  if (error) throw error;
  return (data || []) as unknown as ProdutoComposicaoRow[];
}

export type ProdutoFornecedorRow = {
  id: string;
  fornecedor_id: string;
  eh_principal: boolean | null;
  descricao_fornecedor: string | null;
  referencia_fornecedor: string | null;
  unidade_fornecedor: string | null;
  lead_time_dias: number | null;
  preco_compra: number | null;
};

export async function listProdutoFornecedores(produtoId: string): Promise<ProdutoFornecedorRow[]> {
  const { data, error } = await supabase
    .from("produtos_fornecedores")
    .select("*")
    .eq("produto_id", produtoId);
  if (error) throw error;
  return (data || []) as ProdutoFornecedorRow[];
}

export async function saveProdutoComposicao(params: {
  produtoPaiId: string;
  itens: { produto_filho_id: string; quantidade: number }[];
  ehComposto: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("save_produto_composicao", {
    p_produto_pai_id: params.produtoPaiId,
    p_itens: params.itens,
    p_payload: { eh_composto: params.ehComposto },
  });
  if (error) throw new Error("Erro ao salvar composição: " + (error.message || "tente novamente"));
}

export async function saveProdutoFornecedores(params: {
  produtoId: string;
  itens: Array<{
    fornecedor_id: string;
    eh_principal: boolean;
    descricao_fornecedor: string;
    referencia_fornecedor: string;
    unidade_fornecedor: string;
    lead_time_dias: string;
    preco_compra: string;
  }>;
}): Promise<void> {
  const { error } = await supabase.rpc("save_produto_fornecedores", {
    p_produto_id: params.produtoId,
    p_itens: params.itens,
  });
  if (error) throw new Error("Erro ao salvar fornecedores: " + (error.message || "tente novamente"));
}