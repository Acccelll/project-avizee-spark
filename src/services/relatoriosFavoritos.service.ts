import { supabase } from "@/integrations/supabase/client";

export interface DbFavoritoRow {
  id: string;
  nome: string;
  params: string;
  criado_em: string;
}

export async function listRelatoriosFavoritos() {
  return supabase
    .from("relatorios_favoritos")
    .select("id, nome, params, criado_em")
    .order("criado_em", { ascending: true });
}

export async function insertRelatoriosFavoritos(rows: Array<{
  user_id: string;
  nome: string;
  params: string;
  criado_em?: string;
}>) {
  return supabase
    .from("relatorios_favoritos")
    .insert(rows)
    .select("id, nome, params, criado_em");
}

export async function insertRelatorioFavorito(row: { user_id: string; nome: string; params: string }) {
  return supabase
    .from("relatorios_favoritos")
    .insert(row)
    .select("id, nome, params, criado_em")
    .single();
}

export async function deleteRelatorioFavorito(id: string) {
  return supabase.from("relatorios_favoritos").delete().eq("id", id);
}

export async function renameRelatorioFavorito(id: string, nome: string) {
  return supabase.from("relatorios_favoritos").update({ nome }).eq("id", id);
}