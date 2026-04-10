/**
 * Hooks for Estoque reports (Posição de Estoque, Movimentos, Estoque Mínimo,
 * Curva ABC, Margem de Produtos).
 */

import { useRelatorio } from "./useRelatorio";
import type { EstoqueFilters } from "@/types/relatorios";

export function useRelatorioEstoque(filters: EstoqueFilters = {}) {
  return useRelatorio("estoque", filters);
}

export function useRelatorioMovimentosEstoque(
  filters: EstoqueFilters & { dataInicio?: string; dataFim?: string } = {}
) {
  return useRelatorio("movimentos_estoque", filters);
}

export function useRelatorioEstoqueMinimo(filters: EstoqueFilters = {}) {
  return useRelatorio("estoque_minimo", filters);
}

export function useRelatorioCurvaAbc(
  filters: Pick<EstoqueFilters, never> & {
    dataInicio?: string;
    dataFim?: string;
    clienteIds?: string[];
  } = {}
) {
  return useRelatorio("curva_abc", filters);
}

export function useRelatorioMargemProdutos(filters: EstoqueFilters = {}) {
  return useRelatorio("margem_produtos", filters);
}
