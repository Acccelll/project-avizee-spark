import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { getUserFriendlyError } from "@/utils/errorMessages";

type TableName = keyof Database["public"]["Tables"];
type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type TableInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];

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
}

function applyFilters<Q>(query: Q, filters: CrudFilter[]): Q {
  let q = query as any;
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
  return q as Q;
}

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
}: UseCrudOptions) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  // Serialize filter to stabilise queryKey across parent re-renders
  const filterKey = JSON.stringify(filter);

  const queryKey = useMemo(
    () => [table, select, orderBy, ascending, filterKey, searchTerm, page],
    [table, select, orderBy, ascending, filterKey, searchTerm, page],
  );

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase) {
        return { rows: [] as TableRow<T>[], totalCount: null as number | null, hasMore: false, truncated: false };
      }

      let query: any = (supabase.from as any)(table)
        .select(select, { count: "exact" })
        .order(orderBy, { ascending });

      query = applyFilters(query, filter);

      // Apply search OR filter
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch && searchColumns.length > 0) {
        const orFilter = searchColumns.map((col) => `${col}.ilike.%${trimmedSearch}%`).join(",");
        query = query.or(orFilter);
      }

      // Apply ativo filter AFTER the OR to ensure it's always AND'd
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

      const rows = (result ?? []) as TableRow<T>[];
      const truncated = count !== null && rows.length < count && !pageSize;
      const hasMore = pageSize ? rows.length === pageSize : false;

      return { rows, totalCount: count, hasMore, truncated };
    },
  });

  const invalidateTable = () => queryClient.invalidateQueries({ queryKey: [table] });

  const createMutation = useMutation({
    mutationFn: async (record: Partial<TableInsert<T>>) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as any)(table).insert(record).select().single();
      if (error) throw error;
      return result as unknown as TableRow<T>;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro criado com sucesso!");
      invalidateTable();
    },
    onError: (err) => {
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, record }: { id: string; record: Partial<TableRow<T>> }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as any)(table).update(record).eq("id", id).select().single();
      if (error) throw error;
      return result as unknown as TableRow<T>;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro atualizado com sucesso!");
      invalidateTable();
    },
    onError: (err) => {
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, soft = true }: { id: string; soft?: boolean }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      if (soft && hasAtivo) {
        const { error } = await (supabase.from as any)(table).update({ ativo: false }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)(table).delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro removido com sucesso!");
      invalidateTable();
    },
    onError: (err) => {
      if (showToasts) toast.error(getUserFriendlyError(err));
    },
  });

  const create = (record: Partial<TableInsert<T>>) => createMutation.mutateAsync(record);
  const update = (id: string, record: Partial<TableRow<T>>) => updateMutation.mutateAsync({ id, record });
  const remove = (id: string, soft = true) => removeMutation.mutateAsync({ id, soft });

  const duplicate = async (item: TableRow<T>) => {
    const copy = { ...item } as Record<string, unknown>;
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;

    const transformed = duplicateTransform ? duplicateTransform(copy) : copy;
    return create(transformed as Partial<TableInsert<T>>);
  };

  return {
    data: queryResult.data?.rows ?? [],
    loading: queryResult.isLoading,
    fetchData: () => queryResult.refetch(),
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
