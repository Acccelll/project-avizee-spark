/** Helpers de comparativo PY/Budget e agregações trimestrais/YTD. */

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function monthRange(inicio: string, fim: string): string[] {
  const [yi, mi] = inicio.slice(0, 7).split('-').map(Number);
  const [yf, mf] = fim.slice(0, 7).split('-').map(Number);
  const months: string[] = [];
  let y = yi, m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES_PT[m - 1]}/${String(y).slice(2)}`;
}

export function priorYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

export function variation(cy: number, base: number): number {
  if (!base) return 0;
  return (cy - base) / Math.abs(base);
}

export function aggregateQuarter(values: number[]): { q1: number; q2: number; q3: number; q4: number; ytd: number } {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  return {
    q1: sum(values.slice(0, 3)),
    q2: sum(values.slice(3, 6)),
    q3: sum(values.slice(6, 9)),
    q4: sum(values.slice(9, 12)),
    ytd: sum(values),
  };
}

export function indexByCompetencia<T extends { competencia: string }>(
  arr: T[],
  picker: (item: T) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const k = item.competencia.slice(0, 7);
    out[k] = (out[k] ?? 0) + picker(item);
  }
  return out;
}