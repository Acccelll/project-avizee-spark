/**
 * Fornecedores service — operações que escapam do `useSupabaseCrud` em
 * `pages/Fornecedores.tsx`. O CRUD principal segue via hook genérico;
 * este módulo cobre vínculos com produtos.
 */
import { supabase } from "@/integrations/supabase/client";

export async function deleteProdutoFornecedor(vinculoId: string): Promise<void> {
  const { error } = await supabase
    .from("produtos_fornecedores")
    .delete()
    .eq("id", vinculoId);
  if (error) throw error;
}