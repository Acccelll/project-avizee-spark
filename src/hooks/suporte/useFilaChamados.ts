import { useQuery } from "@tanstack/react-query";
import * as svc from "@/services/suporte/chamados.service";

/**
 * Fila administrativa (seção 18 da especificação). RLS libera para admin ver
 * todos os chamados; ordenação já vem por prioridade + mais antigo primeiro.
 */
export function useFilaChamados() {
  const query = useQuery({
    queryKey: ["suporte_fila_chamados"],
    queryFn: () => svc.listFilaChamados(),
    refetchInterval: 60 * 1000,
  });

  return {
    chamados: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
