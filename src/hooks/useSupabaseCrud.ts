import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

type QueryBuilder = {
  eq: (column: string, value: Primitive) => QueryBuilder;
  neq: (column: string, value: Primitive) => QueryBuilder;
  gt: (column: string, value: Primitive) => QueryBuilder;
  gte: (column: string, value: Primitive) => QueryBuilder;
  lt: (column: string, value: Primitive) => QueryBuilder;
  lte: (column: string, value: Primitive) => QueryBuilder;
  like: (column: string, value: Primitive) => QueryBuilder;
  ilike: (column: string, value: Primitive) => QueryBuilder;
  in: (column: string, value: Primitive[]) => QueryBuilder;
  or: (filters: string) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
};

const applyFilters = (query: QueryBuilder, filters: CrudFilter[]) => {
  let nextQuery = query;
  for (const f of filters) {
    const op = f.operator || "eq";
    switch (op) {
      case "neq":
        nextQuery = nextQuery.neq(f.column, f.value as Primitive);
        break;
      case "gt":
        nextQuery = nextQuery.gt(f.column, f.value as Primitive);
        break;
      case "gte":
        nextQuery = nextQuery.gte(f.column, f.value as Primitive);
        break;
      case "lt":
        nextQuery = nextQuery.lt(f.column, f.value as Primitive);
        break;
      case "lte":
        nextQuery = nextQuery.lte(f.column, f.value as Primitive);
        break;
      case "like":
        nextQuery = nextQuery.like(f.column, f.value as Primitive);
        break;
      case "ilike":
        nextQuery = nextQuery.ilike(f.column, f.value as Primitive);
        break;
      case "in":
        nextQuery = nextQuery.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
        break;
      default:
        nextQuery = nextQuery.eq(f.column, f.value as Primitive);
    }
  }
  return nextQuery;
};

export function useSupabaseCrud<T = Record<string, unknown>>({
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
}: UseCrudOptions) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const queryKey = useMemo(
    () => [table, select, orderBy, ascending, filter, searchTerm, page],
    [table, select, orderBy, ascending, filter, searchTerm, page],
  );

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase) {
        return { rows: [] as T[], totalCount: null as number | null, hasMore: false, truncated: false };
      }

      let query = (supabase.from as any)(table).select(select, { count: "exact" }).order(orderBy, { ascending }) as unknown as QueryBuilder & PromiseLike<{ data: T[] | null; error: Error | null; count: number | null }>;

      if (hasAtivo) {
        query = query.eq("ativo", true) as typeof query;
      }

      query = applyFilters(query, filter) as typeof query;

      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch && searchColumns.length > 0) {
        const orFilter = searchColumns.map((col) => `${col}.ilike.%${trimmedSearch}%`).join(",");
        query = query.or(orFilter) as typeof query;
      }

      if (pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1) as typeof query;
      }

      const { data: result, error, count } = await query;

      if (error) {
        if (showToasts) toast.error("Erro ao carregar dados. Tente novamente.");
        throw error;
      }

      const rows = result ?? [];
      const truncated = count !== null && rows.length < count && !pageSize;
      const hasMore = pageSize ? rows.length === pageSize : false;

      return { rows, totalCount: count, hasMore, truncated };
    },
  });

  const invalidateTable = () => queryClient.invalidateQueries({ queryKey: [table] });

  const createMutation = useMutation({
    mutationFn: async (record: Partial<T>) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as any)(table).insert(record).select().single();
      if (error) throw error;
      return result as unknown as T;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro criado com sucesso!");
      invalidateTable();
    },
    onError: () => {
      if (showToasts) toast.error("Erro ao criar registro. Tente novamente.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, record }: { id: string; record: Partial<T> }) => {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: result, error } = await (supabase.from as any)(table).update(record).eq("id", id).select().single();
      if (error) throw error;
      return result as unknown as T;
    },
    onSuccess: () => {
      if (showToasts) toast.success("Registro atualizado com sucesso!");
      invalidateTable();
    },
    onError: () => {
      if (showToasts) toast.error("Erro ao atualizar registro. Tente novamente.");
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
    onError: () => {
      if (showToasts) toast.error("Erro ao remover registro. Tente novamente.");
    },
  });

  const create = (record: Partial<T>) => createMutation.mutateAsync(record);
  const update = (id: string, record: Partial<T>) => updateMutation.mutateAsync({ id, record });
  const remove = (id: string, soft = true) => removeMutation.mutateAsync({ id, soft });

  const duplicate = async (item: T) => {
    const copy = { ...item } as Record<string, unknown>;
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    if (typeof copy.nome === "string") copy.nome = `${copy.nome} (cópia)`;
    if (typeof copy.nome_razao_social === "string") copy.nome_razao_social = `${copy.nome_razao_social} (cópia)`;
    if (typeof copy.numero === "string") copy.numero = `${copy.numero}-CPY`;
    if (typeof copy.sku === "string") copy.sku = `${copy.sku}-CPY`;
    delete copy.cpf_cnpj;
    delete copy.codigo_interno;
    return create(copy as Partial<T>);
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
