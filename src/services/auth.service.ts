import { supabase } from "@/integrations/supabase/client";

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