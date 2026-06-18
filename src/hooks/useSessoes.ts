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
import {
import { logger } from "@/lib/logger";
  listSessoesAtivas,
  revogarSessaoAtiva,
  type SessaoAtiva,
} from "@/services/admin/adminSessions.service";

export type { SessaoAtiva };

const QUERY_KEY = ["admin", "sessoes-ativas"] as const;

export function useSessoes() {
  const queryClient = useQueryClient();

  const query = useQuery<SessaoAtiva[], Error>({
    queryKey: QUERY_KEY,
    queryFn: listSessoesAtivas,
    staleTime: 60 * 1000,
    retry: false,
  });

  const revogarMutation = useMutation({
    mutationFn: (userId: string) => revogarSessaoAtiva(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Sessão encerrada com sucesso.");
    },
    onError: (err: Error) => {
      logger.error("[admin] Erro ao revogar sessão:", err);
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
