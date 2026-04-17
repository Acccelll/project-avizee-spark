/**
 * Generic React Query hook for the Reports module.
 *
 * This hook is used directly by Relatorios.tsx for all report types, providing
 * a single integration point with a consistent query key, staleTime and
 * placeholderData strategy.
 *
 * Specialised hooks (useRelatorioVendas, useRelatorioFinanceiro,
 * useRelatorioEstoque) wrap this hook with a `select` function to add
 * pre-computed derived data (e.g. vendasPorPeriodo, agingPorFaixa). They are
 * available for consumers that need those computed values directly without
 * having to duplicate the transformation logic.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  carregarRelatorio,
  type TipoRelatorio,
  type FiltroRelatorio,
  type RelatorioResultado,
} from "@/services/relatorios.service";

export const RELATORIO_STALE_TIME = 10 * 60 * 1000; // 10 minutes

export function useRelatorio<TSelected = RelatorioResultado>(
  tipo: TipoRelatorio | "",
  filtros: FiltroRelatorio = {},
  select?: (data: RelatorioResultado) => TSelected,
  enabled = true
) {
  return useQuery<RelatorioResultado, Error, TSelected>({
    queryKey: ["relatorio", tipo, filtros],
    queryFn: () => carregarRelatorio(tipo as TipoRelatorio, filtros),
    staleTime: RELATORIO_STALE_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    enabled: enabled && !!tipo,
    select,
  });
}
