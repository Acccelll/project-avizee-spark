/**
 * Serviço de sessões de usuário — listagem e revogação de sessões ativas.
 *
 * Utiliza a tabela `user_sessions` do banco de dados.
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

/**
 * Lista sessões de usuários.
 */
export async function listarSessoes(
  options: ListarSessoesOptions = {}
): Promise<UserSession[]> {
  const { apenasAtivas = true, userId } = options;

  let query = (supabase as any)
    .from("user_sessions")
    .select("*")
    .order("last_active_at", { ascending: false });

  if (apenasAtivas) {
    query = query.eq("is_active", true);
  }
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Revoga (encerra) uma sessão pelo seu ID.
 * Define `is_active = false` no registro correspondente.
 */
export async function revogarSessao(sessionId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("user_sessions")
    .update({ is_active: false })
    .eq("id", sessionId);

  if (error) throw error;
}
