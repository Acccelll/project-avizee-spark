/**
 * Fornecedores service — operações que escapam do `useSupabaseCrud` em
 * `pages/Fornecedores.tsx`. O CRUD principal segue via hook genérico;
 * este módulo cobre vínculos com produtos.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoFornecedorRow {
  id: string;
  lead_time_dias: number | null;
  preco_compra: number | null;
  eh_principal: boolean | null;
  produtos: { nome: string } | null;
}

export interface CompraResumoRow {
  id: string;
  data_compra: string | null;
  valor_total: number | null;
}

export async function listProdutosDoFornecedor(
  fornecedorId: string,
  limit = 5,
): Promise<ProdutoFornecedorRow[]> {
  const { data, error } = await supabase
    .from("produtos_fornecedores")
    .select("id, lead_time_dias, preco_compra, eh_principal, produtos(nome)")
    .eq("fornecedor_id", fornecedorId)
    .order("eh_principal", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ProdutoFornecedorRow[];
}

export async function listComprasDoFornecedor(
  fornecedorId: string,
  limit = 20,
): Promise<CompraResumoRow[]> {
  const { data, error } = await supabase
    .from("compras")
    .select("id, data_compra, valor_total")
    .eq("fornecedor_id", fornecedorId)
    .eq("ativo", true)
    .order("data_compra", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as CompraResumoRow[];
}

export async function deleteProdutoFornecedor(vinculoId: string): Promise<void> {
  const { error } = await supabase
    .from("produtos_fornecedores")
    .delete()
    .eq("id", vinculoId);
  if (error) throw error;
}

export async function deleteFornecedor(id: string): Promise<void> {
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}