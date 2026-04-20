/**
 * Fetches the reference data needed by the Reports module filter controls:
 *   - clientes (up to 300 active)
 *   - fornecedores (up to 300 active)
 *   - grupos de produto (all active)
 *   - empresa config (name / CNPJ for PDF header)
 *
 * Data is cached for 30 minutes — these lists change rarely.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteRef {
  id: string;
  nome_razao_social: string;
}

export interface FornecedorRef {
  id: string;
  nome_razao_social: string;
}

export interface GrupoProdutoRef {
  id: string;
  nome: string;
}

export interface EmpresaConfigRef {
  razao_social?: string;
  cnpj?: string;
  nome_fantasia?: string;
}

const STALE = 30 * 60 * 1000; // 30 minutes

function useClientesRef() {
  return useQuery<ClienteRef[]>({
    queryKey: ["ref-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_razao_social")
        .eq("ativo", true)
        .order("nome_razao_social")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

function useFornecedoresRef() {
  return useQuery<FornecedorRef[]>({
    queryKey: ["ref-fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome_razao_social")
        .eq("ativo", true)
        .order("nome_razao_social")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

function useGruposRef() {
  return useQuery<GrupoProdutoRef[]>({
    queryKey: ["ref-grupos-produto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos_produto")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

function useEmpresaConfig() {
  return useQuery<EmpresaConfigRef | null>({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_config")
        .select("razao_social, cnpj, nome_fantasia")
        .limit(1)
        .single();
      if (error) return null;
      return (data as EmpresaConfigRef) ?? null;
    },
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

/** Aggregates all reference data needed by the Reports module. */
export function useRelatoriosFiltrosData() {
  const clientes = useClientesRef();
  const fornecedores = useFornecedoresRef();
  const grupos = useGruposRef();
  const empresaConfig = useEmpresaConfig();

  return {
    clientes: clientes.data ?? [],
    fornecedores: fornecedores.data ?? [],
    grupos: grupos.data ?? [],
    empresaConfig: empresaConfig.data ?? null,
    limits: {
      clientes: 300,
      fornecedores: 300,
    },
  };
}
