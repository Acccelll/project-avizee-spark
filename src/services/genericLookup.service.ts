import { supabase } from "@/integrations/supabase/client";

export type DeepLinkTable =
  | "clientes"
  | "fornecedores"
  | "produtos"
  | "transportadoras"
  | "funcionarios"
  | "grupos_economicos"
  | "formas_pagamento"
  | "unidades_medida";

/**
 * Busca uma única linha por id em tabelas suportadas pelo deep-link `?editId=`.
 * Centraliza a I/O Supabase usada pelo `useEditDeepLink`.
 */
export async function fetchByIdGeneric(table: DeepLinkTable, id: string) {
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  return data;
}