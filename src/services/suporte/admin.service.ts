import { supabase } from "@/integrations/supabase/client";

export interface SuporteAdminUsuario {
  id: string;
  nome: string;
}

/**
 * Lista administradores para o seletor "Atribuir para..." (seção 20).
 * V1 usa modelo simples de responsável (um admin) — sem equipes/níveis.
 */
export async function listAdminUsuarios(): Promise<SuporteAdminUsuario[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (rolesError) throw rolesError;

  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", ids)
    .order("nome");
  if (profilesError) throw profilesError;

  return (profiles ?? []).map((p) => ({ id: p.id, nome: p.nome }));
}
