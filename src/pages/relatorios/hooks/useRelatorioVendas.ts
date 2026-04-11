// @ts-nocheck
/**
 * Hook for the "Vendas" and "Faturamento" reports.
 *
 * Encapsulates React Query configuration with:
 *   - 10-minute staleTime (sales data changes infrequently in batch)
 *   - keepPreviousData to avoid loading flicker when changing filters
 *   - select to pre-process rows into chart-ready aggregations
 */

import { useRelatorio } from "./useRelatorio";
import { agruparVendasPorPeriodo } from "@/utils/relatorios";
import type { VendasFilters } from "@/types/relatorios";
import type { RelatorioResultado } from "@/services/relatorios.service";
import type { VendasRow } from "@/types/relatorios";

export interface RelatorioVendasResult extends RelatorioResultado {
  vendasPorPeriodo: Array<{ name: string; value: number }>;
}

export function useRelatorioVendas(filters: VendasFilters = {}) {
  const { agrupamento, ...filtros } = filters;

  return useRelatorio<RelatorioVendasResult>("vendas", filtros, (data) => {
    const rows = data.rows as VendasRow[];
    return {
      ...data,
      vendasPorPeriodo: agruparVendasPorPeriodo(rows, agrupamento ?? "mes"),
    };
  });
}

export function useRelatorioFaturamento(
  filters: Pick<VendasFilters, "dataInicio" | "dataFim" | "clienteIds"> = {}
) {
  return useRelatorio("faturamento", filters);
}
