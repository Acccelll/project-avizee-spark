export type ChartKind = 'coluna' | 'linha' | 'barra_horizontal' | 'donut' | 'tabela' | 'cards' | 'waterfall' | 'stacked';

export interface ChartSeries {
  label: string;
  values: number[];
}

export interface ChartPayload {
  kind: ChartKind;
  categories: string[];
  series: ChartSeries[];
}

export function pickRows(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(payload.series) && payload.series.length && typeof payload.series[0] === 'object') {
    return payload.series as Array<Record<string, unknown>>;
  }
  if (Array.isArray(payload.table) && payload.table.length && typeof payload.table[0] === 'object') {
    return payload.table as Array<Record<string, unknown>>;
  }
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
      return value as Array<Record<string, unknown>>;
    }
  }
  return [];
}
