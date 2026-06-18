/**
 * Preços especiais — encapsula CRUD da tabela `precos_especiais`,
 * usada pelo componente PrecosEspeciaisTab.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/services/_lib/fetchAllPages";

export interface PrecoEspecialRow {
  id: string;
  cliente_id: string | null;
  produto_id: string | null;
  preco_especial: number;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  clientes: { nome_razao_social: string } | null;
  produtos: { nome: string; sku: string | null; preco_venda: number | null; variacoes: unknown } | null;
}

export interface PrecoEspecialPayload {
  cliente_id: string;
  produto_id: string;
  preco_especial: number;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
}

export async function listPrecosEspeciais(filters: {
  clienteId?: string;
  produtoId?: string;
}): Promise<PrecoEspecialRow[]> {
  const data = await fetchAllPages<PrecoEspecialRow>(() => {
    let q = supabase
      .from("precos_especiais")
      .select("*, clientes(nome_razao_social), produtos(nome, sku, preco_venda, variacoes)")
      .eq("ativo", true);
    if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
    if (filters.produtoId) q = q.eq("produto_id", filters.produtoId);
    return q.order("created_at", { ascending: false }) as never;
  });
  return data;
}

export async function listClientesAtivosBasic() {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome_razao_social")
    .eq("ativo", true)
    .limit(500); // cadastro pequeno — teto defensivo
  if (error) throw error;
  return data || [];
}

export async function listProdutosAtivosBasic() {
  return await fetchAllPages(() =>
    supabase
      .from("produtos")
      .select("id, nome, sku, variacoes")
      .eq("ativo", true)
      .order("nome"),
  );
}

export async function upsertPrecoEspecial(
  payload: PrecoEspecialPayload,
  editingId: string | null,
): Promise<void> {
  if (editingId) {
    const { error } = await supabase
      .from("precos_especiais")
      .update(payload)
      .eq("id", editingId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("precos_especiais").insert(payload);
    if (error) throw error;
  }
}

export async function softDeletePrecoEspecial(id: string): Promise<void> {
  const { error } = await supabase
    .from("precos_especiais")
    .update({ ativo: false })
    .eq("id", id);
  if (error) throw error;
}
