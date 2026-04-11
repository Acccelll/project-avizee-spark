/**
 * Serviço de usuários — operações CRUD sobre `profiles` e `user_roles`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];

export interface UsuarioComPerfil extends Profile {
  roles: AppRole[];
}

/** Busca todos os usuários (profiles) com seus papéis. */
export async function fetchUsuarios(): Promise<UsuarioComPerfil[]> {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;

  const rolesByUser = (roles ?? []).reduce<Record<string, AppRole[]>>(
    (acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row.role);
      return acc;
    },
    {}
  );

  return (profiles ?? []).map((p) => ({
    ...p,
    roles: rolesByUser[p.id] ?? [],
  }));
}

/** Atualiza o perfil de um usuário. */
export async function updateUsuario(
  id: string,
  data: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
): Promise<Profile> {
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/** Define o papel de um usuário (substitui o papel atual). */
export async function setUsuarioRole(userId: string, role: AppRole): Promise<void> {
  // Remove todos os papéis anteriores e insere o novo
  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (insertError) throw insertError;
}

/** Desativa um usuário (sem excluir — preserva histórico). */
export async function desativarUsuario(id: string): Promise<void> {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", id);
  if (error) throw error;
}
