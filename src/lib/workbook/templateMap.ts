/** Sheet names used in the workbook template */
export const RAW_SHEET_NAMES = {
  RECEITA: 'RAW_Receita',
  DESPESA: 'RAW_Despesa',
  FATURAMENTO: 'RAW_Faturamento',
  FOPAG: 'RAW_FOPAG',
  CAIXA: 'RAW_Caixa',
  ESTOQUE: 'RAW_Estoque',
  AGING_CR: 'RAW_AgingCR',
  AGING_CP: 'RAW_AgingCP',
  PARAMETROS: 'RAW_Parametros',
} as const;

export const VISUAL_SHEET_NAMES = {
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

// Backward compat
export const SHEET_NAMES = VISUAL_SHEET_NAMES;
export type SheetName = (typeof VISUAL_SHEET_NAMES)[keyof typeof VISUAL_SHEET_NAMES];

/** Maps template code to physical asset path (relative import) */
export const TEMPLATE_ASSET_MAP: Record<string, string> = {
  WB_GERENCIAL_V1: '/src/assets/templates/workbook_gerencial_v1.xlsx',
};
