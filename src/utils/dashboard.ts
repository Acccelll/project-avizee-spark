/** Calculates the percentage growth between two values.
 *  Returns 0 if the base value is 0 (no division by zero). */
export function calcularCrescimentoPercentual(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

export interface VendaDiaria {
  /** ISO date string YYYY-MM-DD */
  data: string;
  total: number;
}

/** Aggregates an array of {data_emissao, valor_total} records into daily totals.
 *  Rows with the same date are summed.  The result is sorted ascending by date. */
export function agregarVendasPorDia(
  rows: Array<{ data_emissao: string; valor_total: number | string | null }>
): VendaDiaria[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const dia = row.data_emissao.slice(0, 10);
    map.set(dia, (map.get(dia) ?? 0) + Number(row.valor_total ?? 0));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, total]) => ({ data, total }));
}
