import { useQuery } from "@tanstack/react-query";
import { listAdminUsuarios } from "@/services/suporte/admin.service";

/** Lista de administradores para o seletor "Atribuir para..." (seção 20). */
export function useAdminUsuarios() {
  const query = useQuery({
    queryKey: ["suporte_admin_usuarios"],
    queryFn: listAdminUsuarios,
    staleTime: 5 * 60 * 1000,
  });

  return { admins: query.data ?? [], loading: query.isLoading };
}
