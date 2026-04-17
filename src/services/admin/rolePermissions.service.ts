/**
 * Serviço da matriz canônica de permissões por papel (`role_permissions`).
 *
 * O modelo de autorização do ERP combina:
 *  1. **role_permissions** — permissão padrão por papel (admin, financeiro, ...).
 *  2. **user_permissions** — override individual (concede ou revoga) por usuário.
 *
 * A função SQL `user_has_permission(user, resource, action)` consolida as duas
 * fontes; o frontend consome essa decisão via RPC quando necessário.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RolePermission = Database["public"]["Tables"]["role_permissions"]["Row"];

/** Lista permissões padrão de um papel. */
export async function fetchRolePermissions(role: AppRole): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .eq("role", role);
  if (error) throw error;
  return data ?? [];
}

/** Lista todas as permissões padrão da matriz. */
export async function fetchAllRolePermissions(): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .order("role")
    .order("resource")
    .order("action");
  if (error) throw error;
  return data ?? [];
}

/** Concede ou ajusta uma permissão padrão a um papel (apenas admin). */
export async function setRolePermission(
  role: AppRole,
  resource: string,
  action: string,
  allowed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { role, resource, action, allowed },
      { onConflict: "role,resource,action" },
    );
  if (error) throw error;
}

/** Remove uma permissão padrão de um papel (apenas admin). */
export async function removeRolePermission(
  role: AppRole,
  resource: string,
  action: string,
): Promise<void> {
  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role", role)
    .eq("resource", resource)
    .eq("action", action);
  if (error) throw error;
}

/**
 * Pergunta ao banco se um usuário tem permissão para um par (recurso, ação),
 * combinando matriz por papel e overrides individuais.
 */
export async function userHasPermission(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_has_permission", {
    _user_id: userId,
    _resource: resource,
    _action: action,
  });
  if (error) throw error;
  return Boolean(data);
}
