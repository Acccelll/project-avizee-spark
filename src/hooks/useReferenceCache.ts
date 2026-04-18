import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useReferenceCache — caches de dados de referência (clientes, fornecedores,
 * contas bancárias, grupos de produto) compartilhados por várias listagens.
 *
 * Substitui dezenas de `useEffect(() => supabase.from("clientes")...)`
 * espalhados pelas páginas. Cada hook usa um queryKey global, então
 * o cache do React Query é reaproveitado entre módulos.
 *
 * staleTime: 5 minutos. Listas de cadastro mudam raramente; quem precisar
 * forçar refresh pode chamar `queryClient.invalidateQueries(["ref","..."])`.
 */

const STALE = 5 * 60 * 1000;

export interface ClienteRef {
  id: string;
  nome_razao_social: string;
}
export interface FornecedorRef {
  id: string;
  nome_razao_social: string;
}
export interface ContaBancariaRef {
  id: string;
  descricao: string;
}
export interface GrupoProdutoRef {
  id: string;
  nome: string;
}

export function useClientesRef(opts?: { ativosOnly?: boolean; limit?: number }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  const limit = opts?.limit ?? 1000;
  return useQuery<ClienteRef[]>({
    queryKey: ["ref", "clientes", { ativosOnly, limit }],
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id, nome_razao_social")
        .order("nome_razao_social")
        .limit(limit);
      if (ativosOnly) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClienteRef[];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export function useFornecedoresRef(opts?: { ativosOnly?: boolean; limit?: number }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  const limit = opts?.limit ?? 1000;
  return useQuery<FornecedorRef[]>({
    queryKey: ["ref", "fornecedores", { ativosOnly, limit }],
    queryFn: async () => {
      let q = supabase
        .from("fornecedores")
        .select("id, nome_razao_social")
        .order("nome_razao_social")
        .limit(limit);
      if (ativosOnly) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FornecedorRef[];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export function useContasBancariasRef(opts?: { ativasOnly?: boolean }) {
  const ativasOnly = opts?.ativasOnly ?? true;
  return useQuery<ContaBancariaRef[]>({
    queryKey: ["ref", "contas_bancarias", { ativasOnly }],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id, descricao").order("descricao");
      if (ativasOnly) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContaBancariaRef[];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export function useGruposProdutoRef(opts?: { ativosOnly?: boolean }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  return useQuery<GrupoProdutoRef[]>({
    queryKey: ["ref", "grupos_produto", { ativosOnly }],
    queryFn: async () => {
      let q = supabase.from("grupos_produto").select("id, nome").order("nome");
      if (ativosOnly) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GrupoProdutoRef[];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}
