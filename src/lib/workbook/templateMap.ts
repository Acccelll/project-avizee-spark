export const SHEET_NAMES = {
  CONFRONTO: 'Confronto',
  CAIXA: 'Caixa',
  DESPESA: 'Despesa',
  FOPAG: 'FOPAG',
  FATURAMENTO: 'Faturamento NFs',
  ESTOQUE: 'Estoque',
  AGING_CR: 'Aging CR',
  AGING_CP: 'Aging CP',
  PARAMETROS: 'Parâmetros',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

// Keep old exports for backward compat (unused but avoids breaks)
export const RAW_SHEET_NAMES = SHEET_NAMES;
export const RAW_SHEET_HEADERS: Record<string, string[]> = {};
