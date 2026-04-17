/**
 * Serviço de perfis — operações sobre `user_roles` e permissões extra
 * (`user_permissions`).
 *
 * NOTA: `concederPermissao` e `revogarPermissao` são usadas pelo fluxo de
 * permissões extras por usuário individual (canônico). As funções `fetchPerfisUsuario`,
 * `atribuirPerfil` e `removerPerfil` são paralelas ao fluxo principal da edge
 * function `admin-users` — prefira o fluxo canônico para criação/alteração de roles.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type UserPermission = Database["public"]["Tables"]["user_permissions"]["Row"];

/** Busca os papéis de um usuário específico. */
export async function fetchPerfisUsuario(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((r) => r.role);
}

/** Busca as permissões extras de um usuário específico. */
export async function fetchPermissoesExtras(userId: string): Promise<UserPermission[]> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

/** Atribui um novo papel a um usuário. */
export async function atribuirPerfil(userId: string, role: AppRole): Promise<void> {
  // Upsert: evita duplicatas
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) throw error;
}

/** Remove um papel de um usuário. */
export async function removerPerfil(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);

  if (error) throw error;
}

/** Concede uma permissão extra a um usuário. */
export async function concederPermissao(
  userId: string,
  resource: string,
  action: string
): Promise<void> {
  const { error } = await supabase.from("user_permissions").upsert(
    { user_id: userId, resource, action, allowed: true },
    { onConflict: "user_id,resource,action" }
  );

  if (error) throw error;
}

/** Revoga uma permissão extra de um usuário. */
export async function revogarPermissao(
  userId: string,
  resource: string,
  action: string
): Promise<void> {
  const { error } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_id", userId)
    .eq("resource", resource)
    .eq("action", action);

  if (error) throw error;
}
