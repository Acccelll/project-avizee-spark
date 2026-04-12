export interface SlideDefinition {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  dataset: string;
  optional?: boolean;
  requiredData?: string[];
  hiddenWhenEmpty?: boolean;
}

export const SLIDE_DEFINITIONS: SlideDefinition[] = [
  { codigo: 'cover', titulo: 'Fechamento Mensal', dataset: 'highlights' },
  { codigo: 'highlights_financeiros', titulo: 'Highlights Financeiros', dataset: 'highlights' },

  // Fase 2: Novos Slides Executivos
  { codigo: 'dre_gerencial', titulo: 'P&L / DRE Gerencial', dataset: 'dreGerencial', optional: true },
  { codigo: 'bridge_ebitda', titulo: 'Bridge EBITDA', dataset: 'bridgeEbitda', optional: true },

  { codigo: 'faturamento', titulo: 'Faturamento', dataset: 'faturamento' },
  { codigo: 'despesas', titulo: 'Despesas', dataset: 'despesas' },
  { codigo: 'rol_caixa', titulo: 'Caixa / ROL', dataset: 'rolCaixa' },
  { codigo: 'receita_vs_despesa', titulo: 'Receita vs Despesa', dataset: 'receitaVsDespesa' },

  // Fase 2: Capital de Giro e Aging
  { codigo: 'capital_giro', titulo: 'Working Capital', dataset: 'capitalGiro', optional: true },
  { codigo: 'aging_consolidado', titulo: 'Aging Consolidado', dataset: 'agingConsolidado', optional: true },
  { codigo: 'inadimplencia', titulo: 'Inadimplência', dataset: 'inadimplencia', optional: true },

  { codigo: 'fopag', titulo: 'FOPAG', dataset: 'fopag' },
  { codigo: 'fluxo_caixa', titulo: 'Fluxo de Caixa', dataset: 'fluxoCaixa' },

  // Fase 2: Resultado Financeiro e Tributos
  { codigo: 'resultado_financeiro', titulo: 'Resultado Financeiro', dataset: 'resultadoFinanceiro', optional: true },
  { codigo: 'tributos', titulo: 'Tributos', dataset: 'tributos', optional: true },

  // Fase 2: Estrutura Patrimonial
  { codigo: 'debt', titulo: 'Debt / Endividamento', dataset: 'debt', optional: true },
  { codigo: 'balanco_gerencial', titulo: 'Balanço Gerencial', dataset: 'balancoGerencial', optional: true },

  { codigo: 'lucro_produto_cliente', titulo: 'Lucro por Produto e Cliente', dataset: 'lucroProdutoCliente' },
  { codigo: 'variacao_estoque', titulo: 'Variação de Estoque', dataset: 'variacaoEstoque' },

  // Fase 2: Comercial e Operacional
  { codigo: 'top_clientes', titulo: 'Destaque Clientes', dataset: 'topClientes', optional: true },
  { codigo: 'top_fornecedores', titulo: 'Destaque Fornecedores', dataset: 'topFornecedores', optional: true },
  { codigo: 'backorder', titulo: 'Backorder / Carteira', dataset: 'backorder', optional: true },

  { codigo: 'venda_state', titulo: 'Venda por Estado', dataset: 'vendaEstado' },
  { codigo: 'redes_sociais', titulo: 'Redes Sociais', dataset: 'redesSociais' },
];
