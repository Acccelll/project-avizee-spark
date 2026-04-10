/**
 * Generic React Query hook for the Reports module.
 *
 * Used internally by the specialised hooks (useRelatorioVendas, etc.) to avoid
 * repeating the same React Query options on every hook.
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
  tipo: TipoRelatorio,
  filtros: FiltroRelatorio = {},
  select?: (data: RelatorioResultado) => TSelected
) {
  return useQuery<RelatorioResultado, Error, TSelected>({
    queryKey: ["relatorio", tipo, filtros],
    queryFn: () => carregarRelatorio(tipo, filtros),
    staleTime: RELATORIO_STALE_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    select,
  });
}
