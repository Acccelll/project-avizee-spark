import type { HelpEntry } from '../types';

export const estoqueHelp: HelpEntry = {
  route: '/estoque',
  title: 'Estoque',
  summary: 'Posição atual, movimentações, ajustes manuais e inventário de produtos e insumos — com integridade garantida por trigger no banco.',
  sections: [
    {
      heading: 'Três abas integradas',
      body: 'Saldos (posição atual por produto), Movimentações (histórico cronológico) e Ajuste Manual (correção controlada). A URL guarda a aba ativa.',
    },
    {
      heading: 'Posição atual (Saldos)',
      body: 'A coluna "Saldo" reflete a soma das movimentações (entradas, saídas, ajustes). É mantida pelo trigger `trg_estoque_movimentos_sync` no banco — sempre consistente com o histórico, sem cache.',
    },
    {
      heading: 'Movimentações automáticas',
      body: 'Pedidos faturados (saída), recebimentos de compra (entrada) e devoluções geram movimentações automaticamente. Você não precisa lançar manualmente nesses casos. A coluna "Origem" mostra qual documento gerou.',
    },
    {
      heading: 'Reservas',
      body: 'Quando um pedido é criado, o estoque é reservado (separado do saldo livre, mas sem baixa). A baixa efetiva ocorre no faturamento. Cancelamento libera a reserva.',
    },
    {
      heading: 'Ajustes manuais',
      body: 'Use a aba "Ajuste Manual" para corrigir divergências de inventário. Sempre exige motivo (texto livre) e fica registrado em auditoria com diff antes/depois. Apenas estoquistas e admins podem fazer ajustes.',
    },
    {
      heading: 'Filtros',
      body: 'Por categoria, depósito, situação (abaixo do mínimo, sem giro, zerado) e tipo (produto/insumo). Insumos não geram saída por venda — só por consumo em produção/composição.',
    },
    {
      heading: 'Drill no produto',
      body: 'Clique em uma linha para ver o histórico de movimentações daquele produto, gráfico de saldo no tempo e ações (ajustar, transferir entre depósitos).',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 5', desc: 'Ir para Estoque' },
  ],
  related: [
    { label: 'Produtos', to: '/produtos' },
    { label: 'Compras', to: '/pedidos-compra' },
    { label: 'Logística (recebimentos)', to: '/logistica' },
  ],
  tour: [
    {
      target: 'estoque.tabs',
      title: 'Saldos, Movimentações e Ajustes',
      body: 'Três abas: Saldos (posição atual), Movimentações (histórico) e Ajuste Manual. Em mobile, use a tab; em desktop, há também um atalho no header.',
    },
    {
      target: 'estoque.filtros',
      title: 'Filtros',
      body: 'Filtre por categoria, depósito e situação (abaixo do mínimo, sem giro, etc). Combine com a busca por código, nome ou EAN.',
    },
    {
      target: 'estoque.tabela',
      title: 'Lista de itens',
      body: 'Saldo é calculado por trigger no banco — sempre consistente. Clique em uma linha para ver o histórico completo daquele produto.',
    },
    {
      target: 'estoque.ajusteBtn',
      title: 'Atalho para ajuste manual',
      body: 'Abre direto a aba de Ajuste Manual. Requer motivo obrigatório e fica registrado em auditoria.',
    },
    {
      target: '',
      title: 'Origem das movimentações',
      body: 'Na aba Movimentações, a coluna Origem mostra de onde veio cada baixa/entrada (pedido X, NF Y, ajuste manual). Clique para abrir o documento de origem.',
    },
  ],
  version: 3,
};
