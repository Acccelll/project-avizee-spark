/**
 * Business-logic utilities for the Cadastros module.
 * Extracted to enable unit testing and reuse across pages / columns / views.
 */

// ─── Produto calculations ────────────────────────

export type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado";

/**
 * Determines the stock situation for a product based on current vs minimum stock.
 */
export function getSituacaoEstoque(
  estoqueAtual: number | null | undefined,
  estoqueMinimo: number | null | undefined,
): SituacaoEstoque {
  const atual = Number(estoqueAtual || 0);
  const minimo = Number(estoqueMinimo || 0);
  if (atual <= 0) return "zerado";
  if (minimo > 0 && atual <= minimo) return "critico";
  if (minimo > 0 && atual <= minimo * 1.2) return "atencao";
  return "normal";
}

/**
 * Calculates the gross margin percentage: (venda / custo - 1) * 100.
 * Returns 0 when custo is zero or negative.
 */
export function calcularMargem(precoVenda: number, precoCusto: number | null | undefined): number {
  const custo = Number(precoCusto || 0);
  if (custo <= 0) return 0;
  return (precoVenda / custo - 1) * 100;
}

/**
 * Calculates gross profit: precoVenda - precoCusto.
 */
export function calcularLucroBruto(precoVenda: number, precoCusto: number | null | undefined): number {
  return precoVenda - Number(precoCusto || 0);
}

/**
 * Calculates the composite cost of a product from its composition items.
 */
export function calcularCustoComposto(
  composicao: Array<{ quantidade: number; preco_custo: number | null | undefined }>,
): number {
  return composicao.reduce((sum, c) => sum + c.quantidade * Number(c.preco_custo || 0), 0);
}

/**
 * Calculates the total stock value: estoqueAtual * precoCusto.
 */
export function calcularEstoqueValor(
  estoqueAtual: number | null | undefined,
  precoCusto: number | null | undefined,
): number {
  return Number(estoqueAtual || 0) * Number(precoCusto || 0);
}
