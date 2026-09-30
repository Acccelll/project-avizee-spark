/**
 * Cadastros consultados pelo orçamento e pelo pedido direto: clientes ativos,
 * produtos ativos (com fornecedores) e preços especiais do cliente.
 *
 * Precisam refletir na hora o que foi alterado no cadastro:
 *  - as chaves começam pelo nome da tabela, então qualquer
 *    `invalidateQueries({ queryKey: ["produtos"] })` (ou "clientes",
 *    "precos_especiais") feita ao salvar o cadastro também as invalida;
 *  - `staleTime: 0` + `refetchOnMount: "always"`: ao abrir o orçamento a lista
 *    é recarregada, mesmo que o cadastro tenha sido salvo por outro caminho
 *    (importação, reajuste em lote, outra aba);
 *  - `refetchOnWindowFocus`: ao voltar de outra aba/janela, recarrega.
 * Enquanto recarrega, a lista anterior continua na tela (sem piscar).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import {
  listClientesAtivosOrcamento,
  listPrecosEspeciaisAtuais,
  listProdutosAtivosComFornecedores,
} from "@/services/orcamentos.service";
import { QUERY_GC } from "@/lib/queryConfig";

export const ORCAMENTO_CLIENTES_KEY = ["clientes", "orcamento-form-ativos"] as const;
export const ORCAMENTO_PRODUTOS_KEY = ["produtos", "orcamento-form-ativos"] as const;
export const orcamentoPrecosEspeciaisKey = (clienteId: string) =>
  ["precos_especiais", "orcamento-form", clienteId] as const;

const SEMPRE_ATUAL = {
  staleTime: 0,
  gcTime: QUERY_GC.TRANSACTIONAL,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
};

export const clientesOrcamentoQuery = {
  queryKey: ORCAMENTO_CLIENTES_KEY,
  queryFn: () => listClientesAtivosOrcamento(),
};

export const produtosOrcamentoQuery = {
  queryKey: ORCAMENTO_PRODUTOS_KEY,
  queryFn: () => listProdutosAtivosComFornecedores(),
};

export const precosEspeciaisOrcamentoQuery = (clienteId: string) => ({
  queryKey: orcamentoPrecosEspeciaisKey(clienteId),
  queryFn: () => listPrecosEspeciaisAtuais(clienteId),
});

export function useClientesOrcamento(enabled = true) {
  return useQuery<Tables<"clientes">[]>({ ...clientesOrcamentoQuery, ...SEMPRE_ATUAL, enabled });
}

export function useProdutosOrcamento<T = Tables<"produtos">>(enabled = true) {
  return useQuery<Tables<"produtos">[], Error, T[]>({
    ...produtosOrcamentoQuery,
    ...SEMPRE_ATUAL,
    enabled,
    select: (rows) => rows as unknown as T[],
  });
}

/** Regras de preço especial vigentes do cliente (vazio sem cliente). */
export function usePrecosEspeciaisOrcamento(clienteId: string | null | undefined) {
  return useQuery<Tables<"precos_especiais">[]>({
    ...precosEspeciaisOrcamentoQuery(clienteId ?? ""),
    ...SEMPRE_ATUAL,
    // Troca de cliente não deve mostrar as regras do cliente anterior.
    placeholderData: undefined,
    enabled: !!clienteId,
  });
}
