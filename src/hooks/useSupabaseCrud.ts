import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import type { Database } from "@/integrations/supabase/types";

type Primitive = string | number | boolean;
type Tables = Database["public"]["Tables"];
type TableName = keyof Tables & string;

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

function applyFilters(query: unknown, filters: CrudFilter[]): unknown {
  let q = query as Record<string, (...args: unknown[]) => unknown>;
  for (const f of filters) {
    const op = f.operator || "eq";
    switch (op) {
      case "neq":   q = q.neq(f.column, f.value as Primitive) as typeof q; break;
      case "gt":    q = q.gt(f.column, f.value as Primitive) as typeof q; break;
      case "gte":   q = q.gte(f.column, f.value as Primitive) as typeof q; break;
      case "lt":    q = q.lt(f.column, f.value as Primitive) as typeof q; break;
      case "lte":   q = q.lte(f.column, f.value as Primitive) as typeof q; break;
      case "like":  q = q.like(f.column, f.value as Primitive) as typeof q; break;
      case "ilike": q = q.ilike(f.column, f.value as Primitive) as typeof q; break;
      case "in":    q = q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]) as typeof q; break;
      default:      q = q.eq(f.column, f.value as Primitive) as typeof q;
    }
  }
  return q;
}

/**
 * Generic CRUD hook for Supabase tables.
 *
 * @typeParam T - Table name literal (e.g. `"produtos"`) for type-safe Row/Insert/Update inference.
 *               Falls back to a loose generic when the table is not in the generated types.
 *
 * Supports optimistic updates for update and remove mutations (configurable via `optimistic` option).
 */
export function useSupabaseCrud<T extends string = string>({
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
  // Resolve row types when T is a known table name, otherwise fallback to Record<string, unknown>
  type Row = T extends TableName ? Tables[T]["Row"] : Record<string, unknown>;
  type InsertRow = T extends TableName ? Tables[T]["Insert"] : Partial<Row>;
  type UpdateRow = T extends TableName ? Tables[T]["Update"] : Partial<Row>;

  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const filterKey = JSON.stringify(filter);

  const queryKey = useMemo(
    () => [table, select, orderBy, ascending, filterKey, searchTerm, page],
    [table, select, orderBy, ascending, filterKey, searchTerm, page],
  );

  type QueryResult = { rows: Row[]; totalCount: number | null; hasMore: boolean; truncated: boolean };

  const queryResult = useQuery<QueryResult>({
    queryKey,
    queryFn: async (): Promise<QueryResult> => {
      if (!supabase) {
        return { rows: [] as Row[], totalCount: null, hasMore: false, truncated: false };
      }

      // Use `as any` for .from() to support both typed and untyped table names
      let query = (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
        .select(select, { count: "exact" })
        .order(orderBy, { ascending });

      query = applyFilters(query, filter) as typeof query;

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

      const rows = (result ?? []) as Row[];
      const truncated = count !== null && rows.length < count && !pageSize;
      const hasMore = pageSize ? rows.length === pageSize : false;

      return { rows, totalCount: count, hasMore, truncated };
    },
  });

  const invalidateTable = () => queryClient.invalidateQueries({ queryKey: [table] });

  const createMutation = useMutation({
    mutationFn: async (record: InsertRow) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
        .insert(record as Record<string, unknown>)
        .select()
        .single();
      if (error) throw error;
      return result as Row;
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
    mutationFn: async ({ id, record }: { id: string; record: UpdateRow }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
        .update(record as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result as Row;
    },
    onMutate: optimistic
      ? async ({ id, record }) => {
          await queryClient.cancelQueries({ queryKey: [table] });
          const snapshot = queryClient.getQueryData<QueryResult>(queryKey);
          if (snapshot) {
            queryClient.setQueryData<QueryResult>(queryKey, {
              ...snapshot,
              rows: snapshot.rows.map((row) =>
                (row as Record<string, unknown>).id === id ? { ...row, ...record } as Row : row,
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
        const { error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
          .update({ ativo: false } as Record<string, unknown>)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
          .delete()
          .eq("id", id);
        if (error) throw error;
      }
    },
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
      if (optimistic && context?.snapshot) {
        queryClient.setQueryData<QueryResult>(queryKey, context.snapshot);
      }
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
    onSettled: () => {
      invalidateTable();
    },
  });

  const create = (record: InsertRow) => createMutation.mutateAsync(record);
  const update = (id: string, record: UpdateRow) => updateMutation.mutateAsync({ id, record });
  const remove = (id: string, soft = true) => removeMutation.mutateAsync({ id, soft });

  const duplicate = async (item: Row) => {
    const copy = { ...(item as Record<string, unknown>) };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;

    const transformed = duplicateTransform ? duplicateTransform(copy) : copy;
    return create(transformed as InsertRow);
  };

  return {
    data: queryResult.data?.rows ?? ([] as Row[]),
    loading: queryResult.isLoading,
    fetchData: () => { queryResult.refetch(); },
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
