import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Service do cadastro de Serviços (LC 116/2003) — usado em NFS-e e itens de
 * categoria `servico` em notas fiscais.
 * Camada services como única autoridade de I/O (mem://tech/camada-services-unica).
 */

export type Servico = Tables<"servicos">;

export interface ListServicosParams {
  search?: string;
  ativo?: boolean | null;
  limit?: number;
}

export async function listServicos(params: ListServicosParams = {}): Promise<Servico[]> {
  let q = supabase.from("servicos").select("*").order("descricao", { ascending: true });
  if (typeof params.ativo === "boolean") q = q.eq("ativo", params.ativo);
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    q = q.or(`descricao.ilike.%${s}%,codigo.ilike.%${s}%,codigo_servico_lc116.ilike.%${s}%`);
  }
  if (params.limit) q = q.limit(params.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Servico[];
}

export async function getServico(id: string): Promise<Servico | null> {
  const { data, error } = await supabase.from("servicos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Servico | null) ?? null;
}

export async function createServico(payload: TablesInsert<"servicos">): Promise<Servico> {
  const { data, error } = await supabase
    .from("servicos")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as Servico;
}

export async function updateServico(id: string, payload: TablesUpdate<"servicos">): Promise<void> {
  const { error } = await supabase.from("servicos").update(payload as never).eq("id", id);
  if (error) throw error;
}

export async function arquivarServico(id: string): Promise<void> {
  const { error } = await supabase.from("servicos").update({ ativo: false }).eq("id", id);
  if (error) throw error;
}

export async function deleteServico(id: string): Promise<void> {
  const { error } = await supabase.from("servicos").delete().eq("id", id);
  if (error) throw error;
}