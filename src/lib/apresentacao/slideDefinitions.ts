export interface SlideDefinition {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  dataset: string;
}

export const SLIDE_DEFINITIONS: SlideDefinition[] = [
  { codigo: 'cover', titulo: 'Fechamento Mensal', dataset: 'highlights' },
  { codigo: 'highlights_financeiros', titulo: 'Highlights Financeiros', dataset: 'highlights' },
  { codigo: 'faturamento', titulo: 'Faturamento', dataset: 'faturamento' },
  { codigo: 'despesas', titulo: 'Despesas', dataset: 'despesas' },
  { codigo: 'rol_caixa', titulo: 'Caixa / ROL', dataset: 'rolCaixa' },
  { codigo: 'receita_vs_despesa', titulo: 'Receita vs Despesa', dataset: 'receitaVsDespesa' },
  { codigo: 'fopag', titulo: 'FOPAG', dataset: 'fopag' },
  { codigo: 'fluxo_caixa', titulo: 'Fluxo de Caixa', dataset: 'fluxoCaixa' },
  { codigo: 'lucro_produto_cliente', titulo: 'Lucro por Produto e Cliente', dataset: 'lucroProdutoCliente' },
  { codigo: 'variacao_estoque', titulo: 'Variação de Estoque', dataset: 'variacaoEstoque' },
  { codigo: 'venda_state', titulo: 'Venda por Estado', dataset: 'vendaEstado' },
  { codigo: 'redes_sociais', titulo: 'Redes Sociais', dataset: 'redesSociais' },
];
