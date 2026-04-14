/**
 * Hook de perfis — encapsula React Query para atribuição/revogação de
 * papéis e permissões extras.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  atribuirPerfil,
  concederPermissao,
  fetchPermissoesExtras,
  fetchPerfisUsuario,
  removerPerfil,
  revogarPermissao,
  type AppRole,
} from "@/services/admin/perfis.service";
import { logger } from '@/utils/logger';

export function usePerfis(userId: string) {
  const queryClient = useQueryClient();
  const perfisKey = ["admin", "perfis", userId] as const;
  const permissoesKey = ["admin", "permissoes-extras", userId] as const;

  const perfisQuery = useQuery({
    queryKey: perfisKey,
    queryFn: () => fetchPerfisUsuario(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const permissoesQuery = useQuery({
    queryKey: permissoesKey,
    queryFn: () => fetchPermissoesExtras(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const atribuirMutation = useMutation({
    mutationFn: (role: AppRole) => atribuirPerfil(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: perfisKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success("Perfil atribuído com sucesso.");
    },
    onError: (err: Error) => {
      logger.error("[admin] Erro ao atribuir perfil:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const removerMutation = useMutation({
    mutationFn: (role: AppRole) => removerPerfil(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: perfisKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success("Perfil removido.");
    },
    onError: (err: Error) => {
      logger.error("[admin] Erro ao remover perfil:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const concederMutation = useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      concederPermissao(userId, resource, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissoesKey });
      toast.success("Permissão concedida.");
    },
    onError: (err: Error) => {
      logger.error("[admin] Erro ao conceder permissão:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const revogarMutation = useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      revogarPermissao(userId, resource, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissoesKey });
      toast.success("Permissão revogada.");
    },
    onError: (err: Error) => {
      logger.error("[admin] Erro ao revogar permissão:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    roles: perfisQuery.data ?? [],
    permissoesExtras: permissoesQuery.data ?? [],
    isLoading: perfisQuery.isLoading || permissoesQuery.isLoading,
    handleAtribuir: atribuirMutation.mutate,
    handleRemover: removerMutation.mutate,
    handleConceder: concederMutation.mutate,
    handleRevogar: revogarMutation.mutate,
  };
}
