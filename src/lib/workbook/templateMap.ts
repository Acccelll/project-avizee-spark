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

/**
 * Grupos de abas selecionáveis no diálogo de geração.
 * `id` é o valor armazenado em `parametros.abasSelecionadas`.
 * Quando `abasSelecionadas` está vazio, todas as abas são geradas.
 */
export interface WorkbookSheetGroup {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const WORKBOOK_SHEET_GROUPS: WorkbookSheetGroup[] = [
  { id: 'capa', label: 'Capa Executiva', description: 'KPIs principais e identidade visual', defaultEnabled: true },
  { id: 'financeiro', label: 'Financeiro (DRE, Caixa, Aging)', description: 'DRE gerencial, evolução de caixa, aging CR/CP', defaultEnabled: true },
  { id: 'comercial', label: 'Comercial (Vendas, ABC, Funil)', description: 'Vendas por vendedor, curva ABC, regiões e funil de orçamentos', defaultEnabled: true },
  { id: 'operacional', label: 'Operacional (Compras, Estoque)', description: 'Compras por fornecedor, giro e estoque crítico', defaultEnabled: true },
  { id: 'logistica_fiscal', label: 'Logística e Fiscal', description: 'OTIF de entregas e bases tributárias', defaultEnabled: true },
  { id: 'raw', label: 'Abas RAW (dados brutos)', description: 'Tabelas de origem para auditoria e BI', defaultEnabled: false },
];
