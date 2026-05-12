import { useQuery } from "@tanstack/react-query";
import type { Entrega, EntregaFilters } from "@/types/logistica";
import { fetchEntregasConsolidadas } from "@/services/logistica/entregas.service";

export type { Entrega, EntregaFilters };

export function useEntregas() {
  return useQuery<Entrega[], Error>({
    queryKey: ["entregas"],
    queryFn: fetchEntregasConsolidadas,
    staleTime: 2 * 60 * 1000,
  });
}
