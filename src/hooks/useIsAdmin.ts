import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";

export function useIsAdmin() {
  const { hasRole, loading, permissionsLoaded } = useAuth();
  const { can } = useCan();
  // Aguarda tanto o carregamento da sessão quanto das permissões
  // antes de retornar isAdmin=false — evita redirect indevido para
  // admins reais cujas roles ainda não foram buscadas do banco.
  //
  // Aceita override individual via permissão `administracao:visualizar`
  // — alinha o hook com `AdminRoute`, que já libera acesso para esse par,
  // evitando incoerência entre guard (libera) e UI (esconde badges).
  const isAdmin = hasRole("admin") || can("administracao:visualizar");
  return { isAdmin, loading: loading || !permissionsLoaded };
}
