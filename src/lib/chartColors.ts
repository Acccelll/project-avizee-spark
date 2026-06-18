/**
 * Paleta canônica para gráficos (recharts) — todos os valores são derivados
 * dos tokens HSL definidos em `src/index.css`, de modo que mudanças no
 * tema light/dark propagam automaticamente para os gráficos.
 *
 * Use `CHART_PALETTE` para séries multi-categoria e os tokens nomeados
 * (`CHART_PRIMARY`, `CHART_SUCCESS`, etc.) para séries semânticas
 * (positivo/negativo/aviso).
 *
 * Regra: NUNCA inline hex em componentes de gráfico — importe daqui.
 */
export const CHART_PRIMARY = "hsl(var(--primary))";
export const CHART_SECONDARY = "hsl(var(--secondary))";
export const CHART_SUCCESS = "hsl(var(--success))";
export const CHART_WARNING = "hsl(var(--warning))";
export const CHART_DESTRUCTIVE = "hsl(var(--destructive))";
export const CHART_INFO = "hsl(var(--info))";
export const CHART_MUTED = "hsl(var(--muted-foreground))";

/** Tom translúcido para áreas/preenchimentos (matching stroke). */
export const withAlpha = (token: string, alpha: number) =>
  token.replace("))", `) / ${alpha})`);

/** Paleta categórica padrão (até 8 séries). Ordem estável entre módulos. */
export const CHART_PALETTE: readonly string[] = [
  CHART_PRIMARY,
  CHART_SECONDARY,
  CHART_SUCCESS,
  CHART_WARNING,
  CHART_INFO,
  CHART_DESTRUCTIVE,
  "hsl(var(--accent))",
  CHART_MUTED,
];

/** Cor por intenção semântica (status / KPI). */
export const chartIntent = {
  positive: CHART_SUCCESS,
  negative: CHART_DESTRUCTIVE,
  warning: CHART_WARNING,
  info: CHART_INFO,
  neutral: CHART_MUTED,
  primary: CHART_PRIMARY,
} as const;

export type ChartIntent = keyof typeof chartIntent;