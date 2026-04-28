import type { HelpEntry } from '../types';

export const orcamentosHelp: HelpEntry = {
  route: '/orcamentos',
  title: 'Orçamentos',
  summary: 'Crie, gerencie e converta orçamentos em pedidos. Inclui rentabilidade, templates e envio público para o cliente.',
  sections: [
    {
      heading: 'Fluxo padrão',
      body: 'Rascunho → Enviado ao cliente → Aprovado → Convertido em pedido. Você pode cancelar com motivo a qualquer momento; rascunhos podem ser excluídos definitivamente.',
    },
    {
      heading: 'Itens, descontos e tributação',
      body: 'Adicione itens com preço de tabela ou condição especial. Descontos podem ser % ou R$, por item ou no total. Os impostos são calculados automaticamente conforme regime tributário e CFOP padrão.',
    },
    {
      heading: 'Rentabilidade',
      body: 'A margem é calculada em tempo real a partir do custo médio do produto. Vendedores sem permissão de "rentabilidade" não veem custos nem margens.',
    },
    {
      heading: 'Conversão em pedido',
      body: 'Use a ação "Converter em pedido" para gerar o pedido de venda. O orçamento original fica vinculado e as alterações posteriores no pedido não afetam o orçamento.',
    },
    {
      heading: 'Compartilhamento público',
      body: 'É possível gerar um link público (sem login) para o cliente visualizar e aprovar. O link expira conforme configurado em Administração.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + N', desc: 'Novo orçamento' },
    { keys: 'Ctrl/Cmd + 2', desc: 'Ir para Orçamentos' },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Clientes', to: '/clientes' },
    { label: 'Produtos', to: '/produtos' },
  ],
  tour: [
    {
      target: 'orcamentos.filtros',
      title: 'Filtros e busca',
      body: 'Filtre por status, cliente, vendedor e período. As preferências de filtro ficam salvas por usuário.',
    },
    {
      target: 'orcamentos.tabela',
      title: 'Lista de orçamentos',
      body: 'Clique em uma linha para abrir o drawer com detalhes, ações e histórico. As cores de status seguem o padrão do ERP.',
    },
  ],
  version: 2,
};