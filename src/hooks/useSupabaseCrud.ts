import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

type Primitive = string | number | boolean;

interface CrudFilter {
  column: string;
  value: Primitive | Primitive[];
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in";
}

interface UseCrudOptions {
  table: string;
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  filter?: CrudFilter[];
  hasAtivo?: boolean;
  pageSize?: number;
  showToasts?: boolean;
  searchTerm?: string;
  searchColumns?: string[];
  duplicateTransform?: (item: Record<string, unknown>) => Record<string, unknown>;
  /** Enable optimistic updates for update/remove mutations. Default: true */
  optimistic?: boolean;
}

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
  hasAtivo = true,
  pageSize,
  showToasts = true,
  searchTerm = "",
  searchColumns = [],
  duplicateTransform,
  optimistic = true,
}: UseCrudOptions) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const filterKey = JSON.stringify(filter);

  const queryKey = useMemo(
    () => [table, select, orderBy, ascending, filterKey, searchTerm, page],
    [table, select, orderBy, ascending, filterKey, searchTerm, page],
  );

  type QueryResult = { rows: R[]; totalCount: number | null; hasMore: boolean; truncated: boolean };

  const queryResult = useQuery({
    queryKey,
    queryFn: async (): Promise<QueryResult> => {
      if (!supabase) {
        return { rows: [] as R[], totalCount: null, hasMore: false, truncated: false };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any).from(table)
        .select(select, { count: "exact" })
        .order(orderBy, { ascending });

      query = applyFilters(query, filter);

      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch && searchColumns.length > 0) {
        const orFilter = searchColumns.map((col) => `${col}.ilike.%${trimmedSearch}%`).join(",");
        query = query.or(orFilter);
      }

      if (hasAtivo) {
        query = query.eq("ativo", true);
      }

      if (pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data: result, error, count } = await query;

      if (error) {
        if (showToasts) toast.error("Erro ao carregar dados. Tente novamente.");
        throw error;
      }

      const rows = (result ?? []) as R[];
      const truncated = count !== null && rows.length < count && !pageSize;
      const hasMore = pageSize ? rows.length === pageSize : false;

      return { rows, totalCount: count, hasMore, truncated };
    },
  });

  const invalidateTable = () => queryClient.invalidateQueries({ queryKey: [table] });

  const createMutation = useMutation({
    mutationFn: async (record: Partial<R>) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase as any).from(table).insert(record).select().single();
      if (error) throw error;
      return result as R;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro criado com sucesso!");
      invalidateTable();
    },
    onError: (err: Error) => {
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, record }: { id: string; record: Partial<R> }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase as any).from(table).update(record).eq("id", id).select().single();
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
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
    onSettled: () => {
      invalidateTable();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, soft = true }: { id: string; soft?: boolean }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      if (soft && hasAtivo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).update({ ativo: false }).eq("id", id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).delete().eq("id", id);
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
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
    onSettled: () => {
      invalidateTable();
    },
  });

  const create = (record: Partial<R>) => createMutation.mutateAsync(record);
  const update = (id: string, record: Partial<R>) => updateMutation.mutateAsync({ id, record });
  const remove = (id: string, soft = true) => removeMutation.mutateAsync({ id, soft });

  const duplicate = async (item: R) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy = { ...(item as any) } as Record<string, unknown>;
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
