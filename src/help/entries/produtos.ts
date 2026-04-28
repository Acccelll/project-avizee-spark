import type { HelpEntry } from '../types';

export const produtosHelp: HelpEntry = {
  route: '/produtos',
  title: 'Produtos e insumos',
  summary: 'Cadastro de produtos vendáveis e insumos de produção, com preços, tributação e fornecedores.',
  sections: [
    {
      heading: 'Tipo de item',
      body: 'A coluna "Tipo" diferencia produto (vendável) de insumo (consumido em produção). Insumos não aparecem em orçamentos/pedidos.',
    },
    {
      heading: 'Tributação',
      body: 'NCM, CEST, origem e CSTs configuráveis por regime tributário. Os impostos da NF-e são calculados a partir desses dados + regra fiscal da operação.',
    },
    {
      heading: 'Preços',
      body: 'Tabela base + condições especiais por cliente/grupo. A condição mais específica vence (cliente > grupo > tabela base).',
    },
    {
      heading: 'Fornecedores',
      body: 'Vincule fornecedores ao produto com código, prazo e custo. Usado na geração automática de pedidos de compra.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + P', desc: 'Ir para Produtos' },
  ],
  related: [
    { label: 'Estoque', to: '/estoque' },
    { label: 'Fornecedores', to: '/fornecedores' },
  ],
  tour: [
    {
      target: 'produtos.filtros',
      title: 'Filtros',
      body: 'Filtre por tipo, categoria, status e situação fiscal (NCM válido, etc).',
    },
    {
      target: 'produtos.tabela',
      title: 'Lista',
      body: 'Clique em uma linha para ver tabs: Geral, Tributação, Preços, Fornecedores, Estoque.',
    },
  ],
  version: 2,
};