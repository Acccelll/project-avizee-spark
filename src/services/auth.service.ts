import { supabase } from "@/integrations/supabase/client";
import type { PermissionKey } from "@/lib/permissions";

/* -------- Profile / Roles / Permissions (lidos pelo AuthContext) -------- */

export interface AuthProfileRow {
  nome: string | null;
  email: string | null;
  cargo: string | null;
  avatar_url: string | null;
}

export async function fetchAuthProfile(userId: string): Promise<AuthProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("nome,email,cargo,avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data as AuthProfileRow | null) ?? null;
}

export async function fetchAuthRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data as Array<{ role: string }> | null) ?? []).map((r) => r.role);
}

export interface AuthPermissionsResult {
  allowed: PermissionKey[];
  denied: PermissionKey[];
}

export async function fetchAuthPermissions(userId: string): Promise<AuthPermissionsResult> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("resource, action, allowed")
    .eq("user_id", userId);
  if (error) throw error;
  const allowed: PermissionKey[] = [];
  const denied: PermissionKey[] = [];
  for (const row of (data || []) as Array<{ resource: string; action: string; allowed: boolean }>) {
    const key = `${row.resource}:${row.action}` as PermissionKey;
    if (row.allowed) allowed.push(key);
    else denied.push(key);
  }
  return { allowed, denied };
}

/* -------- Perfil -------- */

export async function saveUserProfile(input: { nome: string; cargo: string }): Promise<void> {
  const { error } = await supabase.rpc("save_user_profile", {
    p_nome: input.nome,
    p_cargo: input.cargo,
  });
  if (error) throw error;
}

/* -------- Senha / sessão -------- */

/**
 * Reautentica via signInWithPassword. Usado para validar a senha atual antes
 * de permitir troca. Retorna `null` em sucesso ou a `Error` original em falha.
 */
export async function verifyPasswordReauth(input: {
  email: string;
  password: string;
}): Promise<Error | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  return error ?? null;
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOutOtherSessions(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}

/* -------- Auditoria self-update -------- */

export interface SelfUpdateAuditInput {
  tipoAcao: string;
  entidade: string;
  entidadeId: string;
  alteracao: Record<string, unknown>;
  motivo?: string;
}

export async function logSelfUpdateAudit(input: SelfUpdateAuditInput): Promise<void> {
  const { error } = await supabase.rpc("log_self_update_audit", {
    p_tipo_acao: input.tipoAcao,
    p_entidade: input.entidade,
    p_entidade_id: input.entidadeId,
    p_alteracao: input.alteracao as never,
    p_motivo: input.motivo,
  });
  if (error) throw error;
}