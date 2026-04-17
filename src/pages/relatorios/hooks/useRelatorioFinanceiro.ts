/**
 * Hooks for Financeiro reports (Contas a Pagar/Receber, Fluxo de Caixa, Aging, DRE).
 *
 * Each hook uses a specific React Query key so they cache independently.
 */

import { useRelatorio } from "./useRelatorio";
import { agruparAgingPorFaixa } from "@/utils/relatorios";
import type { FinanceiroFilters } from "@/types/relatorios";
import type { AgingRow } from "@/types/relatorios";
import type { RelatorioResultado } from "@/services/relatorios.service";

export function useRelatorioFinanceiro(filters: FinanceiroFilters = {}) {
  return useRelatorio("financeiro", filters);
}

export function useRelatorioFluxoCaixa(
  filters: Pick<FinanceiroFilters, "dataInicio" | "dataFim"> = {}
) {
  return useRelatorio("fluxo_caixa", filters);
}

export interface RelatorioAgingResult extends RelatorioResultado {
  agingPorFaixa: Array<{ name: string; value: number }>;
}

export function useRelatorioAging(filters: FinanceiroFilters = {}) {
  return useRelatorio<RelatorioAgingResult>("aging", filters, (data) => ({
    ...data,
    agingPorFaixa: agruparAgingPorFaixa(data.rows as unknown as AgingRow[]),
  }));
}

export function useRelatorioDre(
  filters: Pick<FinanceiroFilters, "dataInicio" | "dataFim"> = {}
) {
  return useRelatorio("dre", filters);
}
