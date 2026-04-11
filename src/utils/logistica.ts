/**
 * Pure calculation helpers for the Logística module.
 *
 * All functions are side-effect-free so they can be unit-tested without mocks.
 */

/**
 * CEP validation pattern: 8 digits, optionally formatted as 00000-000.
 */
const CEP_PATTERN = /^\d{5}-?\d{3}$/;

/**
 * Validates a Brazilian CEP (postal code).
 * Accepts both formatted (00000-000) and raw (00000000) forms.
 */
export function validarCep(cep: string): boolean {
  return CEP_PATTERN.test(cep.trim());
}

export interface ItemFrete {
  peso_kg: number;
  quantidade: number;
}

export interface FreteInput {
  itens: ItemFrete[];
  /** Distance in km between origin and destination */
  distancia_km: number;
  /** Optional fixed base cost override. Defaults to 5.00 */
  custo_base?: number;
  /** Cost per kg per km. Defaults to 0.05 */
  custo_por_kg_km?: number;
}

/**
 * Estimates the shipping cost (frete) based on total weight and distance.
 *
 * Formula: custo_base + (peso_total_kg × distancia_km × custo_por_kg_km)
 *
 * @throws when distancia_km is negative
 * @throws when any item weight or quantity is negative
 */
export function calcularFreteEstimado({
  itens,
  distancia_km,
  custo_base = 5.0,
  custo_por_kg_km = 0.05,
}: FreteInput): number {
  if (distancia_km < 0) {
    throw new Error("distancia_km não pode ser negativa");
  }

  const pesoTotal = itens.reduce((sum, item) => {
    if (item.peso_kg < 0 || item.quantidade < 0) {
      throw new Error("Peso e quantidade dos itens devem ser não-negativos");
    }
    return sum + item.peso_kg * item.quantidade;
  }, 0);

  return custo_base + pesoTotal * distancia_km * custo_por_kg_km;
}

export interface PrazoInput {
  distancia_km: number;
  /** Average transport speed in km/day. Defaults to 400 km/day */
  velocidade_km_por_dia?: number;
  /** Extra handling days added to the calculated transit time. Defaults to 1 */
  dias_manuseio?: number;
}

/**
 * Estimates the delivery deadline in calendar days.
 *
 * Formula: ceil(distancia_km / velocidade_km_por_dia) + dias_manuseio
 *
 * Returns at least 1 day (same-city delivery).
 *
 * @throws when distancia_km is negative
 */
export function calcularPrazoEntrega({
  distancia_km,
  velocidade_km_por_dia = 400,
  dias_manuseio = 1,
}: PrazoInput): number {
  if (distancia_km < 0) {
    throw new Error("distancia_km não pode ser negativa");
  }

  if (velocidade_km_por_dia <= 0) {
    throw new Error("velocidade_km_por_dia deve ser maior que zero");
  }

  const diasTransito = Math.ceil(distancia_km / velocidade_km_por_dia);
  return Math.max(1, diasTransito + dias_manuseio);
}
