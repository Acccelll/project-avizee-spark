import type { SlideCodigo } from '@/types/apresentacao';

export interface SlideDefinition {
  codigo: SlideCodigo;
  titulo: string;
  subtitulo: string;
  chartType: 'coluna' | 'linha' | 'barra_horizontal' | 'donut' | 'tabela' | 'cards' | 'texto';
  dependencies: string[];
  expectedDatasets: string[];
}

export const APRESENTACAO_SLIDES_V1: SlideDefinition[] = [
  { codigo: 'cover', titulo: 'Fechamento Mensal', subtitulo: 'Apresentação Gerencial', chartType: 'texto', dependencies: [], expectedDatasets: [] },
  { codigo: 'highlights_financeiros', titulo: 'Highlights Financeiros', subtitulo: 'Resumo executivo do período', chartType: 'cards', dependencies: ['vw_apresentacao_highlights_financeiros'], expectedDatasets: ['kpis', 'variacoes'] },
  { codigo: 'faturamento', titulo: 'Faturamento', subtitulo: 'Evolução e composição', chartType: 'coluna', dependencies: ['vw_apresentacao_faturamento'], expectedDatasets: ['serie_mensal'] },
  { codigo: 'despesas', titulo: 'Despesas', subtitulo: 'Consolidação por competência', chartType: 'coluna', dependencies: ['vw_apresentacao_despesas'], expectedDatasets: ['serie_mensal'] },
  { codigo: 'rol_caixa', titulo: 'Caixa / ROL', subtitulo: 'Posição de liquidez', chartType: 'cards', dependencies: ['vw_apresentacao_rol_caixa'], expectedDatasets: ['caixa_total', 'rol'] },
  { codigo: 'receita_vs_despesa', titulo: 'Receita vs Despesa', subtitulo: 'Comparativo mensal', chartType: 'linha', dependencies: ['vw_apresentacao_receita_vs_despesa'], expectedDatasets: ['receita', 'despesa'] },
  { codigo: 'fopag', titulo: 'FOPAG', subtitulo: 'Folha de pagamento', chartType: 'tabela', dependencies: ['vw_apresentacao_fopag'], expectedDatasets: ['resumo_fopag'] },
  { codigo: 'fluxo_caixa', titulo: 'Fluxo de Caixa', subtitulo: 'Entradas e saídas', chartType: 'linha', dependencies: ['vw_apresentacao_fluxo_caixa'], expectedDatasets: ['fluxo'] },
  { codigo: 'lucro_produto_cliente', titulo: 'Lucro por Produto e Cliente', subtitulo: 'Top contribuições', chartType: 'barra_horizontal', dependencies: ['vw_apresentacao_lucro_produto_cliente'], expectedDatasets: ['top_produtos', 'top_clientes'] },
  { codigo: 'variacao_estoque', titulo: 'Variação de Estoque', subtitulo: 'Posição e giro', chartType: 'tabela', dependencies: ['vw_apresentacao_variacao_estoque'], expectedDatasets: ['estoque'] },
  { codigo: 'venda_estado', titulo: 'Venda por Estado', subtitulo: 'Distribuição geográfica', chartType: 'barra_horizontal', dependencies: ['vw_apresentacao_venda_estado'], expectedDatasets: ['uf'] },
  { codigo: 'redes_sociais', titulo: 'Redes Sociais', subtitulo: 'Indicadores de crescimento', chartType: 'cards', dependencies: ['vw_apresentacao_redes_sociais'], expectedDatasets: ['social'] },
];
