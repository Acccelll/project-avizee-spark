import { useQuery } from "@tanstack/react-query";
import { fetchKpisFiscal } from "@/services/fiscal/dashboardFiscal.service";

/**
 * Filtros aceitos pela RPC `kpis_fiscal`.
 * Espelha exatamente os parâmetros da função no banco para garantir
 * paridade entre os cards de KPI e a listagem paginada.
 */
export interface FiscalKpisFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  tipos?: string[] | null;
  status?: string[] | null;
  fornecedores?: string[] | null;
  clientes?: string[] | null;
  modelos?: string[] | null;
  search?: string | null;
}

export type { FiscalKpisResult } from "@/services/fiscal/dashboardFiscal.service";

/**
 * Carrega os KPIs do módulo Fiscal via RPC `kpis_fiscal`, aplicando os
 * mesmos filtros server-side da listagem paginada para manter os cards
 * coerentes com a tabela.
 */
export function useFiscalKpis(filters: FiscalKpisFilters) {
  return useQuery({
    queryKey: ["kpis_fiscal", filters],
    queryFn: () => fetchKpisFiscal(filters),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}