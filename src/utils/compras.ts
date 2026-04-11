/**
 * Pure calculation helpers for the Compras module.
 *
 * All functions are side-effect-free so they can be unit-tested without mocks.
 */

export interface ItemCompra {
  quantidade: number;
  valor_unitario: number;
}

/**
 * Calculates the subtotal of purchase items (sum of quantidade × valor_unitario).
 */
export function calcularSubtotal(itens: ItemCompra[]): number {
  return itens.reduce((total, item) => total + item.quantidade * item.valor_unitario, 0);
}

/**
 * Applies a percentage discount to a value.
 * Returns the discounted value: value * (1 - discount/100).
 * @throws if desconto is not in [0, 100]
 */
export function aplicarDesconto(valor: number, desconto: number): number {
  if (desconto < 0 || desconto > 100) {
    throw new Error("Desconto deve ser entre 0 e 100");
  }
  return valor * (1 - desconto / 100);
}

/**
 * Calculates the frete (shipping) cost.
 * Returns 0 when freteValor is negative or zero.
 */
export function calcularFrete(freteValor: number): number {
  if (freteValor < 0) return 0;
  return freteValor;
}

/**
 * Calculates the total purchase value.
 * total = subtotal - desconto + frete + impostos
 */
export function calcularTotalCompra({
  itens,
  descontoPercent = 0,
  freteValor = 0,
  impostosValor = 0,
}: {
  itens: ItemCompra[];
  descontoPercent?: number;
  freteValor?: number;
  impostosValor?: number;
}): number {
  const subtotal = calcularSubtotal(itens);
  const subtotalComDesconto = aplicarDesconto(subtotal, descontoPercent);
  const frete = calcularFrete(freteValor);
  return subtotalComDesconto + frete + impostosValor;
}
