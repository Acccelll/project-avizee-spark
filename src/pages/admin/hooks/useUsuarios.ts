/**
 * Hook de usuários — encapsula React Query para CRUD de usuários no módulo admin.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  desativarUsuario,
  fetchUsuarios,
  setUsuarioRole,
  updateUsuario,
  type AppRole,
  type UsuarioComPerfil,
} from "@/services/admin/usuarios.service";

const QUERY_KEY = ["admin", "usuarios"] as const;

export function useUsuarios() {
  const queryClient = useQueryClient();

  const query = useQuery<UsuarioComPerfil[], Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchUsuarios,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateUsuario>[1];
    }) => updateUsuario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Usuário atualizado com sucesso.");
    },
    onError: (err: Error) => {
      console.error("[admin] Erro ao atualizar usuário:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      setUsuarioRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Perfil do usuário atualizado.");
    },
    onError: (err: Error) => {
      console.error("[admin] Erro ao alterar perfil:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const desativarMutation = useMutation({
    mutationFn: (id: string) => desativarUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Usuário desativado.");
    },
    onError: (err: Error) => {
      console.error("[admin] Erro ao desativar usuário:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    usuarios: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    handleUpdate: updateMutation.mutate,
    handleSetRole: setRoleMutation.mutate,
    handleDesativar: desativarMutation.mutate,
    isUpdating: updateMutation.isPending,
    isSettingRole: setRoleMutation.isPending,
    isDesativando: desativarMutation.isPending,
  };
}
