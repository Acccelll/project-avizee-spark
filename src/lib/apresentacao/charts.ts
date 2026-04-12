export type ChartKind = 'coluna' | 'linha' | 'barra_horizontal' | 'donut' | 'tabela' | 'cards';

export interface ChartSeries {
  label: string;
  values: number[];
}

export interface ChartPayload {
  kind: ChartKind;
  categories: string[];
  series: ChartSeries[];
}
