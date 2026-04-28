import type { HelpEntry } from '../types';

export const produtosHelp: HelpEntry = {
  route: '/produtos',
  title: 'Produtos e insumos',
  summary: 'Cadastro de produtos vendáveis e insumos de produção, com tributação completa, preços, fornecedores e composição.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'KPIs (Total, Produtos, Insumos, sem grupo). Filtros (tipo, categoria, status, situação fiscal). Tabela com tipo, código, nome, categoria, preço e saldo de estoque.',
    },
    {
      heading: 'Tipo de item',
      body: 'A coluna "Tipo" diferencia produto (vendável, aparece em orçamentos/pedidos) de insumo (consumido em produção/composição, não vendido diretamente). A diferenciação está em `produtos.tipo_item`.',
    },
    {
      heading: 'Modal de cadastro',
      body: 'Abas: Dados gerais (código, EAN, nome, categoria, unidade, peso), Estoque (mínimo, máximo, depósito padrão), Fiscal (NCM/CEST/CST/origem), Compras (fornecedores), Observações.',
    },
    {
      heading: 'Tributação',
      body: 'NCM (validado contra base oficial), CEST, origem e CSTs configuráveis por regime tributário. Os impostos da NF-e são calculados a partir desses dados + regra fiscal da operação (CFOP). NCM inválido bloqueia emissão.',
    },
    {
      heading: 'Preços e condições especiais',
      body: 'Tabela base + condições especiais por cliente/grupo. A condição mais específica vence: cliente > grupo > tabela base. Configurar em "Preços especiais" dentro do produto ou por cliente.',
    },
    {
      heading: 'Fornecedores',
      body: 'Vincule fornecedores ao produto com código no fornecedor, prazo médio de entrega e custo. Usado na geração automática de pedidos de compra a partir de pedidos de venda sem estoque.',
    },
    {
      heading: 'Composição (insumos)',
      body: 'Para produtos compostos/produzidos, cadastre a lista de insumos com quantidade. Ao baixar o produto, os insumos são consumidos automaticamente do estoque (kit/composição).',
    },
    {
      heading: 'Estoque',
      body: 'Saldo é calculado pelo trigger no banco — somatório das movimentações. Aba "Estoque" no produto mostra saldo atual, reservado e mínimo/máximo configurado.',
    },
    {
      heading: 'Inativar × Excluir',
      body: 'Inativar: produto some de novos pedidos mas mantém histórico. Excluir: só sem movimento. Recomendado sempre Inativar para produtos com histórico fiscal.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + P', desc: 'Ir para Produtos' },
  ],
  related: [
    { label: 'Estoque', to: '/estoque' },
    { label: 'Fornecedores', to: '/fornecedores' },
    { label: 'Pedidos de compra', to: '/pedidos-compra' },
  ],
  tour: [
    {
      target: 'produtos.filtros',
      title: 'Filtros',
      body: 'Filtre por tipo (produto/insumo), categoria, status e situação fiscal (NCM válido, etc). Combine com busca por código, nome ou EAN.',
    },
    {
      target: 'produtos.tabela',
      title: 'Lista',
      body: 'Clique em uma linha para abrir o cadastro com abas. O badge de tipo distingue produto (vendável) de insumo (consumido em produção).',
    },
    {
      target: 'produtos.novoBtn',
      title: 'Novo produto',
      body: 'Abre o modal com 5 abas. Comece pelo tipo: produto vendável vs insumo de produção. Insumos não aparecem em orçamentos/pedidos.',
    },
    {
      target: '',
      title: 'Aba Fiscal — NCM/CEST/CST',
      body: 'Tributação completa por regime. NCM é validado contra base oficial — inválido bloqueia emissão de NF-e. Configure origem (nacional/importado) e CSTs.',
    },
    {
      target: '',
      title: 'Aba Compras — fornecedores',
      body: 'Vincule fornecedores com código próprio, prazo e custo. Usado em pedidos de compra automáticos quando o estoque do produto fica abaixo do mínimo.',
    },
    {
      target: '',
      title: 'Preços especiais',
      body: 'Configure tabela base + preços especiais por cliente ou grupo. A condição mais específica vence (cliente > grupo > base) na hora do orçamento/pedido.',
    },
  ],
  version: 3,
};
