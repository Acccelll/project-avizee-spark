import { supabase } from "@/integrations/supabase/client";

/**
 * Service para o módulo de Cotações de Compra.
 * Centraliza a I/O usada por `CotacaoCompraForm.tsx` e expõe o RPC
 * `replace_cotacao_compra_itens`, que é a operação atômica canônica
 * para substituir os itens da cotação.
 */

export async function getCotacaoCompra(id: string) {
  const { data, error } = await supabase
    .from("cotacoes_compra")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listCotacaoItens(cotacaoId: string) {
  const { data, error } = await supabase
    .from("cotacoes_compra_itens")
    .select("*, produtos(nome, codigo_interno, sku)")
    .eq("cotacao_compra_id", cotacaoId);
  if (error) throw error;
  return data || [];
}

export async function listCotacaoPropostas(cotacaoId: string) {
  const { data, error } = await supabase
    .from("cotacoes_compra_propostas")
    .select("*, fornecedores(nome_razao_social)")
    .eq("cotacao_compra_id", cotacaoId);
  if (error) throw error;
  return data || [];
}

export async function listProdutosParaCotacao() {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, codigo_interno, sku")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data || [];
}

export async function listFornecedoresParaCotacao() {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome_razao_social, cpf_cnpj")
    .eq("ativo", true)
    .order("nome_razao_social");
  if (error) throw error;
  return data || [];
}

export async function updateCotacaoHeader(
  id: string,
  payload: {
    numero: string;
    data_cotacao: string;
    data_validade: string | null;
    observacoes: string | null;
    status: string;
  },
) {
  const { error } = await supabase
    .from("cotacoes_compra")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function replaceCotacaoItens(
  cotacaoId: string,
  itens: Array<{ produto_id: string; quantidade: number; unidade: string }>,
) {
  const { error } = await supabase.rpc("replace_cotacao_compra_itens", {
    p_cotacao_id: cotacaoId,
    p_itens: itens as unknown as never,
  });
  if (error) throw error;
}

export async function insertCotacaoProposta(input: {
  cotacao_compra_id: string;
  item_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  prazo_entrega_dias: number | null;
  observacoes: string | null;
}) {
  const { error } = await supabase
    .from("cotacoes_compra_propostas")
    .insert({ ...input, selecionado: false });
  if (error) throw error;
}

export async function selectCotacaoProposta(params: {
  cotacaoId: string;
  itemId: string;
  propostaId: string;
}) {
  await Promise.all([
    supabase
      .from("cotacoes_compra_propostas")
      .update({ selecionado: false })
      .eq("cotacao_compra_id", params.cotacaoId)
      .eq("item_id", params.itemId),
    supabase
      .from("cotacoes_compra_propostas")
      .update({ selecionado: true })
      .eq("id", params.propostaId),
  ]);
}

export async function deleteCotacaoProposta(propostaId: string) {
  const { error } = await supabase
    .from("cotacoes_compra_propostas")
    .delete()
    .eq("id", propostaId);
  if (error) throw error;
}