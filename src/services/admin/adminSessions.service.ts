/**
 * Sessões ativas via Edge Function `admin-sessions` (service_role).
 * Distinto de `sessoes.service.ts`, que opera na tabela `user_sessions`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SessaoAtiva {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_agent: string | null;
  ip: string | null;
}

export async function listSessoesAtivas(): Promise<SessaoAtiva[]> {
  const { data, error } = await supabase.functions.invoke<SessaoAtiva[]>(
    "admin-sessions",
    { body: { action: "list" } },
  );
  if (error) throw new Error(error.message ?? "Erro ao listar sessões.");
  return data ?? [];
}

export async function revogarSessaoAtiva(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-sessions", {
    body: { action: "revoke", userId },
  });
  if (error) throw new Error(error.message ?? "Erro ao revogar sessão.");
}
