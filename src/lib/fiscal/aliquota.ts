/** Banco/domínio usam fração decimal; UI usa percentual. */
export function decimalParaPercentual(decimal: number | null | undefined): number | null {
  if (decimal === null || decimal === undefined || !Number.isFinite(Number(decimal))) return null;
  return +(Number(decimal) * 100).toFixed(4);
}

export function percentualParaDecimal(percentual: number | string | null | undefined): number | null {
  if (percentual === null || percentual === undefined || percentual === "") return null;
  const n = typeof percentual === "string" ? Number(percentual.replace(",", ".")) : Number(percentual);
  if (!Number.isFinite(n)) return null;
  return +(n / 100).toFixed(6);
}

export function formatarAliquotaPercentual(decimal: number | null | undefined, casas = 2): string {
  const pct = decimalParaPercentual(decimal);
  return pct === null ? "—" : `${pct.toFixed(casas).replace(".", ",")}%`;
}

export function aliquotaValida(decimal: number | null | undefined): boolean {
  if (decimal === null || decimal === undefined) return true;
  const n = Number(decimal);
  return Number.isFinite(n) && n >= 0 && n <= 1;
}
