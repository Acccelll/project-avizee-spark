import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { hasRole, loading, permissionsLoaded } = useAuth();
  // Aguarda tanto o carregamento da sessão quanto das permissões
  // antes de retornar isAdmin=false — evita redirect indevido para
  // admins reais cujas roles ainda não foram buscadas do banco.
  return { isAdmin: hasRole("admin"), loading: loading || !permissionsLoaded };
}
