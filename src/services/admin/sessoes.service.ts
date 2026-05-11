/**
 * Serviço de sessões de usuário — listagem e revogação de sessões ativas.
 *
 * Delega à Edge Function `admin-sessions` (service_role). A tabela
 * `user_sessions` referenciada antes não existe no schema do projeto;
 * a fonte real de sessões é `auth.users.last_sign_in_at`, lida pela
 * Edge Function. Mantém os tipos `UserSession`/`ListarSessoesOptions`
 * estáveis para consumidores legados.
 */

import { supabase } from "@/integrations/supabase/client";

export interface UserSession {
  id: string;
  user_id: string;
  created_at: string;
  last_active_at: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
}

export interface ListarSessoesOptions {
  /** Filtra somente sessões ativas quando `true` (padrão: `true`). */
  apenasAtivas?: boolean;
  /** Filtra sessões de um usuário específico. */
  userId?: string;
}

interface EdgeSessao {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_agent: string | null;
  ip: string | null;
}

function mapEdgeToUserSession(s: EdgeSessao): UserSession {
  return {
    id: s.id,
    user_id: s.user_id,
    created_at: s.created_at,
    last_active_at: s.last_sign_in_at ?? s.created_at,
    ip_address: s.ip,
    user_agent: s.user_agent,
    is_active: true,
  };
}

/**
 * Lista sessões de usuários.
 */
export async function listarSessoes(
  options: ListarSessoesOptions = {}
): Promise<UserSession[]> {
  const { apenasAtivas = true, userId } = options;

  const { data, error } = await supabase.functions.invoke<EdgeSessao[]>(
    "admin-sessions",
    { body: { action: "list" } },
  );
  if (error) throw new Error(error.message ?? "Erro ao listar sessões.");

  let result = (data ?? []).map(mapEdgeToUserSession);
  if (userId) result = result.filter((s) => s.user_id === userId);
  if (apenasAtivas) result = result.filter((s) => s.is_active);
  result.sort((a, b) => (a.last_active_at < b.last_active_at ? 1 : -1));
  return result;
}

/**
 * Revoga (encerra) a sessão de um usuário via Edge Function `admin-sessions`.
 * A Edge Function opera por `userId` (não por `sessionId`).
 */
export async function revogarSessao(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-sessions", {
    body: { action: "revoke", userId },
  });
  if (error) throw new Error(error.message ?? "Erro ao revogar sessão.");
}
