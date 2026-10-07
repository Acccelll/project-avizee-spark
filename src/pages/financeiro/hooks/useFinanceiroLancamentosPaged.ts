import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "@/types/domain";
import { listarFinanceiroLancamentosIds } from "@/services/financeiro";

/**
 * Filtros server-side espelhando `kpis_financeiro` + busca cross-table.
 * Mantém os mesmos campos consumidos por `useFinanceiroKpisRpc` para que
 * cards de KPI e a listagem paginada caminhem juntos.
 */
export interface FinanceiroPagedFilters {
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

const DEFAULT_PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 500;
const EXPORT_HARD_CAP = 50000;

const SELECT_RELATIONAL =
  "*, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_bancarias(descricao, bancos(nome)), contas_contabeis(descricao, codigo), cartao_faturas(id, competencia, status, data_vencimento, valor_total, cartoes_credito(nome, bandeira, ultimos4))";

interface PageResult {
  rows: Lancamento[];
  totalCount: number;
}

/**
 * Paginação server-side para a listagem de lançamentos.
 *
 * Estratégia em 2 passos para preservar o `select` relacional já consumido
 * pelas colunas/drawer:
 *  1) RPC `listar_financeiro_lancamentos_ids` aplica filtros (incluindo busca
 *     cross-table em cliente/fornecedor/banco) e devolve `ids` da página +
 *     `total_count`.
 *  2) `SELECT ... IN (ids)` reidrata as linhas com joins, preservando ordem
 *     da RPC via `Map<id, row>`.
 */
export function useFinanceiroLancamentosPaged(
  filters: FinanceiroPagedFilters,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sort?: { key: string | null; dir: 'asc' | 'desc' | null },
) {
  const qc = useQueryClient();
  const queryKey = [
    "financeiro", "lancamentos", "paged", filters, page, pageSize,
    sort?.key ?? null, sort?.dir ?? null,
  ] as const;

  const loadPage = useCallback(async (
    offset: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<PageResult> => {
    const orderBy = sort?.key ?? "data_vencimento";
    const ascending = sort?.dir === "asc";
    const { ids, totalCount } = await listarFinanceiroLancamentosIds({
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      tipos: filters.tipos ?? null,
      status: filters.status ?? null,
      bancos: filters.bancos ?? null,
      origens: filters.origens ?? null,
      formas: filters.formas ?? null,
      cartoes: filters.cartoes ?? null,
      search: filters.search ?? null,
      orderBy,
      ascending,
      offset,
      limit,
    });
    if (ids.length === 0) return { rows: [], totalCount };

    let q = supabase
      .from("financeiro_lancamentos")
      .select(SELECT_RELATIONAL)
      .in("id", ids);
    if (signal) q = q.abortSignal(signal);
    const { data: rows, error } = await q;
    if (error) throw error;

    const byId = new Map<string, Lancamento>();
    (rows as Lancamento[] | null)?.forEach((r) => byId.set(r.id, r));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Lancamento[];
    return { rows: ordered, totalCount };
  }, [filters, sort?.key, sort?.dir]);

  const query = useQuery<PageResult>({
    queryKey,
    queryFn: async ({ signal }) => loadPage(page * pageSize, pageSize, signal),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const fetchAllRows = useCallback(async (): Promise<Lancamento[]> => {
    const all: Lancamento[] = [];
    let offset = 0;

    // Sob demanda para exportação: não altera página/caches da UI.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await loadPage(offset, EXPORT_PAGE_SIZE);
      if (result.totalCount > EXPORT_HARD_CAP) {
        throw new Error(
          `A exportação excede o limite seguro de ${EXPORT_HARD_CAP.toLocaleString("pt-BR")} lançamentos. Aplique filtros mais específicos e tente novamente.`,
        );
      }
      all.push(...result.rows);
      if (all.length >= result.totalCount || result.rows.length < EXPORT_PAGE_SIZE) break;
      offset += EXPORT_PAGE_SIZE;
    }
    return all;
  }, [loadPage]);

  // Invalidação centralizada — qualquer mutation pode disparar
  // `["financeiro", "lancamentos"]` que esta página será refeita.
  const refetch = async () => {
    await qc.invalidateQueries({ queryKey: ["financeiro", "lancamentos"] });
  };

  return {
    data: query.data?.rows ?? [],
    totalCount: query.data?.totalCount ?? 0,
    loading: query.isLoading,
    refetching: query.isFetching && !query.isLoading,
    refetch,
    fetchAllRows,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Reseta a página para 0 quando os filtros mudam (evita pedir um offset
 * inexistente após shrink do dataset).
 */
export function useResetPageOnFiltersChange(
  filters: FinanceiroPagedFilters,
  setPage: (p: number) => void,
) {
  const key = JSON.stringify(filters);
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
