/**
 * Hook de sessões ativas — lista e revoga sessões de usuários via
 * Edge Function do Supabase.
 *
 * ⚠️  A listagem e revogação de sessões exige a `service_role` key, que
 * **nunca** deve ser exposta no frontend. Por isso, estas operações são
 * delegadas a uma Supabase Edge Function (`admin-sessions`) que roda no
 * servidor com acesso privilegiado.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
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

const QUERY_KEY = ["admin", "sessoes-ativas"] as const;

async function fetchSessoes(): Promise<SessaoAtiva[]> {
  const { data, error } = await supabase.functions.invoke<SessaoAtiva[]>(
    "admin-sessions",
    { body: { action: "list" } }
  );

  if (error) throw new Error(error.message ?? "Erro ao listar sessões.");
  return data ?? [];
}

async function revogarSessao(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke(
    "admin-sessions",
    { body: { action: "revoke", userId } }
  );

  if (error) throw new Error(error.message ?? "Erro ao revogar sessão.");
}

export function useSessoes() {
  const queryClient = useQueryClient();

  const query = useQuery<SessaoAtiva[], Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchSessoes,
    staleTime: 60 * 1000,
    retry: false,
  });

  const revogarMutation = useMutation({
    mutationFn: (userId: string) => revogarSessao(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Sessão encerrada com sucesso.");
    },
    onError: (err: Error) => {
      console.error("[admin] Erro ao revogar sessão:", err);
      notifyError(err);
    },
  });

  return {
    sessoes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    handleRevogar: revogarMutation.mutate,
    isRevogando: revogarMutation.isPending,
  };
}
