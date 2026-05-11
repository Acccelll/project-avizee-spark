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

export interface FiscalKpisResult {
  totalCount: number;
  rascunho: number;
  pendente: number;
  confirmada: number;
  /** Inclui `confirmada + autorizada + importada` (paridade com o card "Confirmadas"). */
  confirmadas_efetivas: number;
  cancelada: number;
  denegada: number;
  rejeitada: number;
  total_valor: number;
  total_valor_confirmada: number;
  total_entrada: number;
  total_saida: number;
}

const EMPTY: FiscalKpisResult = {
  totalCount: 0,
  rascunho: 0,
  pendente: 0,
  confirmada: 0,
  confirmadas_efetivas: 0,
  cancelada: 0,
  denegada: 0,
  rejeitada: 0,
  total_valor: 0,
  total_valor_confirmada: 0,
  total_entrada: 0,
  total_saida: 0,
};

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