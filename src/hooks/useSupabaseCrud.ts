import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromUntyped } from "@/lib/supabase/fromUntyped";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";

type Primitive = string | number | boolean;

interface CrudFilter {
  column: string;
  value: Primitive | Primitive[];
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in";
}

/** Range de datas (inclusivo nas duas pontas). Use para coluna ISO `date` ou `timestamptz`. */
interface DateRangeFilter {
  column: string;
  /** ISO date string `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ`. */
  from?: string | null;
  /** ISO date string `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ`. */
  to?: string | null;
}

interface UseCrudOptions {
  table: string;
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  filter?: CrudFilter[];
  /**
   * Filtro server-side por intervalo de datas. Aplicado como `gte`/`lte`.
   * Use em telas paginadas para que o range alimente o LIMIT/OFFSET corretamente.
   */
  dateRange?: DateRangeFilter;
  /**
   * Filtro server-side de status (`IN (...)`). Quando `statusValues` for vazio
   * ou `undefined`, nenhum filtro é aplicado.
   */
  statusFilter?: { column: string; values: string[] };
  /**
   * Lista de expressões PostgREST para `.or(...)` adicionais. Cada item é
   * aplicado como um `.or(expr)` separado (que o PostgREST trata como AND
   * entre grupos). Útil para predicados compostos (ex.: "incompleto" =
   * vários OR encadeados) sem deixar o cálculo client-side e perder a
   * paginação server-side.
   */
  orFilters?: string[];
  hasAtivo?: boolean;
  /**
   * Controls whether list queries apply `eq("ativo", true)`.
   * Defaults to `hasAtivo` for backwards compatibility.
   */
  filterAtivo?: boolean;
  /**
   * Controls whether `remove` performs soft-delete (`ativo=false`) when possible.
   * Defaults to `hasAtivo` for backwards compatibility.
   */
  softDelete?: boolean;
  pageSize?: number;
  showToasts?: boolean;
  searchTerm?: string;
  searchColumns?: string[];
  duplicateTransform?: (item: Record<string, unknown>) => Record<string, unknown>;
  /** Enable optimistic updates for update/remove mutations. Default: true */
  optimistic?: boolean;
  /**
   * Pagination strategy:
   *  - 'paged' (default when `pageSize` is set): single ranged request, exposes `hasMore`/`page`.
   *  - 'all' (default when `pageSize` is omitted): fetches everything in chunks of 1000 and concatenates,
   *    bypassing the Supabase 1000-row default limit. Use when the page renders the full dataset locally.
   */
  paginationMode?: "paged" | "all";
  /** Chunk size for `paginationMode: 'all'`. Default 1000 (Supabase max per request). */
  allChunkSize?: number;
}

const CHUNK_FETCH_HARD_CAP = 50000; // safety net to avoid runaway loops

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: CrudFilter[]): any {
  let q = query;
  for (const f of filters) {
    const op = f.operator || "eq";
    switch (op) {
      case "neq":   q = q.neq(f.column, f.value as Primitive); break;
      case "gt":    q = q.gt(f.column, f.value as Primitive); break;
      case "gte":   q = q.gte(f.column, f.value as Primitive); break;
      case "lt":    q = q.lt(f.column, f.value as Primitive); break;
      case "lte":   q = q.lte(f.column, f.value as Primitive); break;
      case "like":  q = q.like(f.column, f.value as Primitive); break;
      case "ilike": q = q.ilike(f.column, f.value as Primitive); break;
      case "in":    q = q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]); break;
      default:      q = q.eq(f.column, f.value as Primitive);
    }
  }
  return q;
}

/**
 * Generic CRUD hook for Supabase tables with optimistic updates.
 *
 * @typeParam R - Row type returned by queries. Callers can pass their domain type
 *               (e.g. `useSupabaseCrud<Cliente>({ table: "clientes" })`).
 *
 * Optimistic updates are enabled by default for update and remove mutations.
 * Set `optimistic: false` to disable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSupabaseCrud<R = any>({
  table,
  select = "*",
  orderBy = "created_at",
  ascending = false,
  filter = [],
  dateRange,
  statusFilter,
  orFilters,
  hasAtivo = true,
  filterAtivo,
  softDelete,
  pageSize,
  showToasts = true,
  searchTerm = "",
  searchColumns = [],
  duplicateTransform,
  optimistic = true,
  paginationMode,
  allChunkSize = 1000,
}: UseCrudOptions) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const shouldFilterAtivo = filterAtivo ?? hasAtivo;
  const shouldSoftDelete = softDelete ?? hasAtivo;

  const filterKey = JSON.stringify(filter);
  const dateRangeKey = dateRange ? JSON.stringify(dateRange) : "";
  const statusKey = statusFilter && statusFilter.values.length > 0
    ? `${statusFilter.column}:${[...statusFilter.values].sort().join(",")}`
    : "";
  const orFiltersKey = orFilters && orFilters.length > 0 ? orFilters.join("|") : "";
  const effectiveMode: "paged" | "all" = paginationMode ?? (pageSize ? "paged" : "all");

  // Reset síncrono: quando filtros/busca/ordem mudam em modo paged, força
  // `page=0` no MESMO render — evita pedir um range inexistente (HTTP 416
  // "Requested range not satisfiable") na primeira query disparada com o
  // filtro novo + page antigo. O `setPage` no microtask sincroniza o state
  // para os próximos renders e para a UI de paginação.
  const filterDepsKey = `${filterKey}|${dateRangeKey}|${statusKey}|${orFiltersKey}|${searchTerm}|${orderBy}|${ascending}`;
  const lastDepsRef = useRef(filterDepsKey);
  let effectivePage = page;
  if (effectiveMode === "paged" && lastDepsRef.current !== filterDepsKey) {
    lastDepsRef.current = filterDepsKey;
    if (page !== 0) {
      effectivePage = 0;
      queueMicrotask(() => setPage(0));
    }
  }

  const queryKey = useMemo(
    () => [table, select, orderBy, ascending, filterKey, dateRangeKey, statusKey, orFiltersKey, searchTerm, effectiveMode, effectivePage, shouldFilterAtivo],
    [table, select, orderBy, ascending, filterKey, dateRangeKey, statusKey, orFiltersKey, searchTerm, effectiveMode, effectivePage, shouldFilterAtivo],
  );

  type QueryResult = { rows: R[]; totalCount: number | null; hasMore: boolean; truncated: boolean };

  const queryResult = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<QueryResult> => {
      if (!supabase) {
        return { rows: [] as R[], totalCount: null, hasMore: false, truncated: false };
      }

      // Helper to assemble a fresh query — needed because we reuse it per chunk in 'all' mode.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildQuery = (): any => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // fromUntyped aceito: tabela é dinâmica (parâmetro da chamada)
        let query: any = fromUntyped(table)
          .select(select, { count: "exact" })
          .order(orderBy, { ascending });
        query = applyFilters(query, filter);
        if (dateRange?.column) {
          if (dateRange.from) query = query.gte(dateRange.column, dateRange.from);
          if (dateRange.to) query = query.lte(dateRange.column, dateRange.to);
        }
        if (statusFilter && statusFilter.values.length > 0) {
          query = query.in(statusFilter.column, statusFilter.values);
        }
        if (orFilters && orFilters.length > 0) {
          for (const expr of orFilters) {
            if (expr) query = query.or(expr);
          }
        }
        const trimmedSearch = searchTerm.trim();
        if (trimmedSearch && searchColumns.length > 0) {
          const orFilter = searchColumns.map((col) => `${col}.ilike.%${trimmedSearch}%`).join(",");
          query = query.or(orFilter);
        }
        if (shouldFilterAtivo) query = query.eq("ativo", true);
        // Propaga o AbortSignal do React Query — quando a query é
        // cancelada (componente desmontado, filtro mudado), o fetch é
        // abortado em vez de continuar até o fim e tentar setState órfão.
        if (signal) query = query.abortSignal(signal);
        return query;
      };

      // ── Paged mode ────────────────────────────────────────────────────────
      if (effectiveMode === "paged" && pageSize) {
        const from = effectivePage * pageSize;
        const { data: result, error, count } = await buildQuery().range(from, from + pageSize - 1);
        if (error) {
          // PGRST103 = Requested range not satisfiable. Acontece quando a página
          // pedida ficou fora do total após shrink do dataset (filtro/busca novos).
          // O reset síncrono acima já agendou o retorno a page=0, então só
          // engolimos o erro silenciosamente em vez de assustar o usuário.
          const code = (error as { code?: string }).code;
          const msg = (error as { message?: string }).message ?? "";
          const isRangeError = code === "PGRST103" || msg.toLowerCase().includes("requested range");
          if (isRangeError) {
            return { rows: [] as R[], totalCount: 0, hasMore: false, truncated: false };
          }
          if (showToasts) notifyError(error);
          throw error;
        }
        const rows = (result ?? []) as R[];
        const knownTotal = count ?? null;
        const hasMore =
          knownTotal != null
            ? (effectivePage + 1) * pageSize < knownTotal
            : rows.length === pageSize;
        return {
          rows,
          totalCount: knownTotal,
          hasMore,
          truncated: false,
        };
      }

      // ── All mode: chunked fetch until count is exhausted ──────────────────
      const all: R[] = [];
      let total: number | null = null;
      let from = 0;
      let truncated = false;

      // Loop until we've fetched everything (or hit the safety cap).
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) {
          // Curto-circuita silenciosamente — React Query já descartou a query.
          return { rows: all, totalCount: total, hasMore: false, truncated };
        }
        const to = from + allChunkSize - 1;
        const { data: result, error, count } = await buildQuery().range(from, to);
        if (error) {
          if (showToasts) notifyError(error);
          throw error;
        }
        const chunk = (result ?? []) as R[];
        if (total === null) total = count ?? null;
        all.push(...chunk);

        // Stop when we've hit either the end of data or the known count.
        if (chunk.length < allChunkSize) break;
        if (total !== null && all.length >= total) break;

        if (all.length >= CHUNK_FETCH_HARD_CAP) {
          truncated = true;
          if (showToasts) {
            toast.warning(
              `Lista limitada a ${CHUNK_FETCH_HARD_CAP.toLocaleString()} registros. Aplique filtros para refinar.`,
            );
          }
          break;
        }
        from += allChunkSize;
      }

      return { rows: all, totalCount: total, hasMore: false, truncated };
    },
  });

  const invalidateTable = () => queryClient.invalidateQueries({ queryKey: [table] });

  // Defesa: se o consumidor pediu uma página fora do range (deep link,
  // shrink após mutação, mudança de filtro), navega para a última página
  // válida em vez de jogar o usuário direto para a primeira — preserva
  // contexto e evita sensação de "salto aleatório".
  useEffect(() => {
    if (effectiveMode !== "paged" || !pageSize) return;
    const total = queryResult.data?.totalCount;
    if (total == null) return;
    if (page > 0 && page * pageSize >= total) {
      const lastPage = total > 0 ? Math.max(0, Math.ceil(total / pageSize) - 1) : 0;
      if (lastPage !== page) setPage(lastPage);
    }
  }, [queryResult.data?.totalCount, page, pageSize, effectiveMode]);

  const createMutation = useMutation({
    mutationFn: async (record: Partial<R>) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // fromUntyped aceito: tabela é dinâmica (parâmetro da chamada)
      const { data: result, error } = await fromUntyped(table).insert(record).select().single();
      if (error) throw error;
      return result as R;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro criado com sucesso!");
      invalidateTable();
    },
    onError: (err: Error) => {
      if (showToasts) notifyError(err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, record }: { id: string; record: Partial<R> }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // fromUntyped aceito: tabela é dinâmica (parâmetro da chamada)
      const { data: result, error } = await fromUntyped(table).update(record).eq("id", id).select().single();
      if (error) throw error;
      return result as R;
    },
    // Optimistic update: immediately reflect changes in the cache
    onMutate: optimistic
      ? async ({ id, record }) => {
          await queryClient.cancelQueries({ queryKey: [table] });
          const snapshot = queryClient.getQueryData<QueryResult>(queryKey);
          if (snapshot) {
            queryClient.setQueryData<QueryResult>(queryKey, {
              ...snapshot,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows: snapshot.rows.map((row) =>
                (row as Record<string, unknown>).id === id ? { ...row, ...record } as R : row,
              ),
            });
          }
          return { snapshot };
        }
      : undefined,
    onSuccess: () => {
      if (showToasts) toast.success("Registro atualizado com sucesso!");
    },
    onError: (err: Error, _vars, context) => {
      // Rollback on error
      if (optimistic && context?.snapshot) {
        queryClient.setQueryData<QueryResult>(queryKey, context.snapshot);
      }
      if (showToasts) notifyError(err);
    },
    onSettled: () => {
      invalidateTable();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, soft = true }: { id: string; soft?: boolean }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      if (soft && shouldSoftDelete) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // fromUntyped aceito: tabela é dinâmica (parâmetro da chamada)
        const { error } = await fromUntyped(table).update({ ativo: false }).eq("id", id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await fromUntyped(table).delete().eq("id", id);
        if (error) throw error;
      }
    },
    // Optimistic remove: immediately hide the item from the cache
    onMutate: optimistic
      ? async ({ id }) => {
          await queryClient.cancelQueries({ queryKey: [table] });
          const snapshot = queryClient.getQueryData<QueryResult>(queryKey);
          if (snapshot) {
            queryClient.setQueryData<QueryResult>(queryKey, {
              ...snapshot,
              rows: snapshot.rows.filter((row) => (row as Record<string, unknown>).id !== id),
            });
          }
          return { snapshot };
        }
      : undefined,
    onSuccess: () => {
      if (showToasts) toast.success("Registro removido com sucesso!");
    },
    onError: (err: Error, _vars, context) => {
      // Rollback on error
      if (optimistic && context?.snapshot) {
        queryClient.setQueryData<QueryResult>(queryKey, context.snapshot);
      }
      if (showToasts) notifyError(err);
    },
    onSettled: () => {
      invalidateTable();
    },
  });

  const create = (record: Partial<R>) => createMutation.mutateAsync(record);
  const update = (id: string, record: Partial<R>) => updateMutation.mutateAsync({ id, record });
  const remove = (id: string, soft = true) => removeMutation.mutateAsync({ id, soft });

  const duplicate = async (item: R) => {
    const copy = { ...(item as unknown as Record<string, unknown>) };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;

    const transformed = duplicateTransform ? duplicateTransform(copy) : copy;
    return create(transformed as Partial<R>);
  };

  return {
    data: queryResult.data?.rows ?? ([] as R[]),
    loading: queryResult.isLoading,
    fetchData: async () => {
      await queryResult.refetch();
    },
    create,
    update,
    remove,
    duplicate,
    page,
    setPage,
    hasMore: queryResult.data?.hasMore ?? false,
    totalCount: queryResult.data?.totalCount ?? null,
    truncated: queryResult.data?.truncated ?? false,
  };
}
