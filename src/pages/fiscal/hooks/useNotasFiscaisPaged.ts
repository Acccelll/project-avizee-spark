import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotaFiscal } from "@/types/domain";
import { fetchNotasFiscaisPaged } from "@/services/fiscal/notasFiscaisPaged.service";

/**
 * Filtros server-side espelhando a RPC `listar_notas_fiscais_ids`.
 * Mantém paridade com `kpis_fiscal` (chamado por `useFiscalKpis`) para que
 * os cards e a listagem caminhem juntos.
 */
export interface NotasFiscaisPagedFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  tipos?: string[] | null;
  status?: string[] | null;
  statusSefaz?: string[] | null;
  modelos?: string[] | null;
  origens?: string[] | null;
  fornecedores?: string[] | null;
  clientes?: string[] | null;
  search?: string | null;
}

const DEFAULT_PAGE_SIZE = 50;

interface PageResult {
  rows: NotaFiscal[];
  totalCount: number;
}

/**
 * Paginação server-side para a listagem de Notas Fiscais.
 * Estratégia em 2 passos (mesma de `useFinanceiroLancamentosPaged`):
 *  1) RPC `listar_notas_fiscais_ids` aplica filtros server-side e devolve
 *     `ids` da página + `total_count`.
 *  2) `SELECT ... IN (ids)` reidrata as linhas com joins (fornecedor,
 *     cliente, ordem de venda) preservando a ordem da RPC.
 */
export function useNotasFiscaisPaged(
  filters: NotasFiscaisPagedFilters,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sort: { orderBy?: "data_emissao" | "numero" | "valor_total" | "created_at"; ascending?: boolean } = {},
) {
  const qc = useQueryClient();
  const orderBy = sort.orderBy ?? "data_emissao";
  const ascending = sort.ascending ?? false;
  const queryKey = ["notas_fiscais", "paged", filters, page, pageSize, orderBy, ascending] as const;

  const query = useQuery<PageResult>({
    queryKey,
    queryFn: async ({ signal }) => {
      return fetchNotasFiscaisPaged({
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        tipos: filters.tipos ?? null,
        status: filters.status ?? null,
        statusSefaz: filters.statusSefaz ?? null,
        modelos: filters.modelos ?? null,
        origens: filters.origens ?? null,
        fornecedores: filters.fornecedores ?? null,
        clientes: filters.clientes ?? null,
        search: filters.search ?? null,
        orderBy,
        ascending,
        offset: page * pageSize,
        limit: pageSize,
        signal,
      });
    },
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const refetch = async () => {
    await qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
  };

  return {
    data: query.data?.rows ?? [],
    totalCount: query.data?.totalCount ?? 0,
    loading: query.isLoading,
    refetching: query.isFetching && !query.isLoading,
    refetch,
    error: query.error,
  };
}

export function useResetPageOnFiltersChange(
  filters: NotasFiscaisPagedFilters,
  setPage: (p: number) => void,
) {
  const key = JSON.stringify(filters);
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}