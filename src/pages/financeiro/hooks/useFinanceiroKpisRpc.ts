import { useQuery } from "@tanstack/react-query";
import { fetchKpisFinanceiro, type KpisFinanceiroResult } from "@/services/financeiro";

/**
 * Filtros aceitos pela RPC `kpis_financeiro`.
 * Espelha os parâmetros server-side para manter os cards coerentes com a
 * listagem paginada do Financeiro.
 */
export interface FinanceiroKpisFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  tipos?: string[] | null;
  status?: string[] | null;
  bancos?: string[] | null;
  origens?: string[] | null;
  formas?: string[] | null;
  cartoes?: string[] | null;
  search?: string | null;
}

export type FinanceiroKpisResult = KpisFinanceiroResult;

/**
 * Carrega os KPIs do módulo Financeiro via RPC `kpis_financeiro`, aplicando
 * os mesmos filtros da listagem para manter os cards coerentes mesmo com
 * paginação server-side.
 */
export function useFinanceiroKpisRpc(filters: FinanceiroKpisFilters) {
  return useQuery({
    queryKey: ["kpis_financeiro", filters],
    queryFn: () => fetchKpisFinanceiro(filters),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}