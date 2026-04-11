export const RAW_SHEET_NAMES = {
  FINANCEIRO: 'RAW_FINANCEIRO',
  CAIXA: 'RAW_CAIXA',
  AGING_CR: 'RAW_AGING_CR',
  AGING_CP: 'RAW_AGING_CP',
  ESTOQUE: 'RAW_ESTOQUE',
  FOPAG: 'RAW_FOPAG',
  BANCOS: 'RAW_BANCOS',
  PARAMETROS: 'RAW_PARAMETROS',
} as const;

export type RawSheetName = (typeof RAW_SHEET_NAMES)[keyof typeof RAW_SHEET_NAMES];

export const RAW_SHEET_HEADERS: Record<RawSheetName, string[]> = {
  RAW_FINANCEIRO: ['tipo', 'competencia', 'data_vencimento', 'valor', 'valor_pago', 'saldo_restante', 'status', 'conta_contabil_id', 'conta_descricao'],
  RAW_CAIXA: ['competencia', 'conta_bancaria_id', 'conta_descricao', 'tipo', 'total_valor', 'qtd_movimentos'],
  RAW_AGING_CR: ['id', 'data_vencimento', 'valor', 'valor_pago', 'saldo_aberto', 'status', 'cliente_id', 'faixa_aging'],
  RAW_AGING_CP: ['id', 'data_vencimento', 'valor', 'valor_pago', 'saldo_aberto', 'status', 'fornecedor_id', 'faixa_aging'],
  RAW_ESTOQUE: ['produto_id', 'nome', 'sku', 'quantidade', 'custo_unitario', 'valor_total', 'grupo_id', 'grupo_descricao'],
  RAW_FOPAG: ['id', 'competencia', 'funcionario_id', 'funcionario_nome', 'cargo', 'departamento', 'salario_base', 'proventos', 'descontos', 'valor_liquido', 'status'],
  RAW_BANCOS: ['id', 'descricao', 'agencia', 'conta', 'saldo_atual', 'banco_nome'],
  RAW_PARAMETROS: ['chave', 'valor'],
};
