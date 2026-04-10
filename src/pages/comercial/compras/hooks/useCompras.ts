import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CompraRow = Database["public"]["Tables"]["compras"]["Row"];

export interface CompraWithFornecedor extends CompraRow {
  fornecedores?: {
    nome_razao_social: string;
    cpf_cnpj: string | null;
  } | null;
}

export interface CompraFilters {
  search?: string;
  fornecedor_id?: string;
  status?: string;
}

async function fetchCompras(filters?: CompraFilters): Promise<CompraWithFornecedor[]> {
  let query = supabase
    .from("compras")
    .select("*, fornecedores(nome_razao_social, cpf_cnpj)")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.fornecedor_id) {
    query = query.eq("fornecedor_id", filters.fornecedor_id);
  }
  if (filters?.search) {
    query = query.ilike("numero", `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []) as CompraWithFornecedor[];
}

export function useCompras(filters?: CompraFilters) {
  return useQuery({
    queryKey: ["compras", filters],
    queryFn: () => fetchCompras(filters),
    staleTime: 5 * 60 * 1000,
  });
}
