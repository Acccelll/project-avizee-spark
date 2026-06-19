import { useQuery } from "@tanstack/react-query";
import { QUERY_STALE } from "@/lib/queryConfig";
import {
  fetchClientesRef,
  fetchFornecedoresRef,
  fetchContasBancariasRef,
  fetchGruposProdutoRef,
  fetchFormasPagamentoRef,
} from "@/services/referenceCache.service";

/**
 * useReferenceCache — caches de dados de referência (clientes, fornecedores,
 * contas bancárias, grupos de produto) compartilhados por várias listagens.
 *
 * Substitui dezenas de `useEffect(() => supabase.from("clientes")...)`
 * espalhados pelas páginas. Cada hook usa um queryKey global, então
 * o cache do React Query é reaproveitado entre módulos.
 *
 * staleTime: tier TRANSACTIONAL (5min) para clientes/fornecedores/contas
 * (mudam ao longo do dia) e REFERENCE (30min) para grupos e formas de
 * pagamento (raramente alterados). Quem precisar forçar refresh pode chamar
 * `queryClient.invalidateQueries(["ref","..."])`.
 */

const STALE_TRANSACTIONAL = QUERY_STALE.TRANSACTIONAL;
const STALE_REFERENCE = QUERY_STALE.REFERENCE;

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
export interface FormaPagamentoRef {
  id: string;
  descricao: string;
  tipo: string | null;
  parcelas: number | null;
  prazo_dias: number | null;
}

export function useClientesRef(opts?: { ativosOnly?: boolean; limit?: number }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  const limit = opts?.limit ?? 1000;
  return useQuery<ClienteRef[]>({
    queryKey: ["ref", "clientes", { ativosOnly, limit }],
    queryFn: () => fetchClientesRef({ ativosOnly, limit }),
    staleTime: STALE_TRANSACTIONAL,
  });
}

export function useFornecedoresRef(opts?: { ativosOnly?: boolean; limit?: number }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  const limit = opts?.limit ?? 1000;
  return useQuery<FornecedorRef[]>({
    queryKey: ["ref", "fornecedores", { ativosOnly, limit }],
    queryFn: () => fetchFornecedoresRef({ ativosOnly, limit }),
    staleTime: STALE_TRANSACTIONAL,
  });
}

export function useContasBancariasRef(opts?: { ativasOnly?: boolean }) {
  const ativasOnly = opts?.ativasOnly ?? true;
  return useQuery<ContaBancariaRef[]>({
    queryKey: ["ref", "contas_bancarias", { ativasOnly }],
    queryFn: () => fetchContasBancariasRef({ ativasOnly }),
    staleTime: STALE_TRANSACTIONAL,
  });
}

export function useGruposProdutoRef(opts?: { ativosOnly?: boolean }) {
  const ativosOnly = opts?.ativosOnly ?? true;
  return useQuery<GrupoProdutoRef[]>({
    queryKey: ["ref", "grupos_produto", { ativosOnly }],
    queryFn: () => fetchGruposProdutoRef({ ativosOnly }),
    staleTime: STALE_REFERENCE,
  });
}

export function useFormasPagamentoRef(opts?: { ativasOnly?: boolean }) {
  const ativasOnly = opts?.ativasOnly ?? true;
  return useQuery<FormaPagamentoRef[]>({
    queryKey: ["ref", "formas_pagamento", { ativasOnly }],
    queryFn: () => fetchFormasPagamentoRef({ ativasOnly }),
    staleTime: STALE_REFERENCE,
  });
}
