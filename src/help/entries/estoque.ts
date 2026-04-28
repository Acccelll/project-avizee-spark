import type { HelpEntry } from '../types';

export const estoqueHelp: HelpEntry = {
  route: '/estoque',
  title: 'Estoque',
  summary: 'Posição atual, movimentações, ajustes e inventário de produtos e insumos.',
  sections: [
    {
      heading: 'Posição atual',
      body: 'A coluna "Saldo" reflete a soma das movimentações (entradas, saídas, ajustes). É mantida por trigger no banco — sempre consistente com o histórico.',
    },
    {
      heading: 'Movimentações automáticas',
      body: 'Pedidos faturados, recebimentos de compra e devoluções geram movimentações automaticamente. Você não precisa lançar manualmente nesses casos.',
    },
    {
      heading: 'Ajustes manuais',
      body: 'Use "Ajustar estoque" para corrigir divergências. Sempre exige motivo e fica registrado em auditoria.',
    },
    {
      heading: 'Reservas',
      body: 'Quando um pedido é criado, o estoque é reservado (sem baixa). A baixa efetiva ocorre no faturamento.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 5', desc: 'Ir para Estoque' },
  ],
  related: [
    { label: 'Produtos', to: '/produtos' },
    { label: 'Compras', to: '/pedidos-compra' },
    { label: 'Logística', to: '/logistica' },
  ],
  tour: [
    {
      target: 'estoque.tabs',
      title: 'Saldos, movimentações e ajustes',
      body: 'A tela tem três abas: Saldos (posição atual), Movimentações (histórico) e Ajuste Manual.',
    },
    {
      target: 'estoque.filtros',
      title: 'Filtros',
      body: 'Filtre por categoria, depósito e situação (abaixo do mínimo, sem giro, etc).',
    },
    {
      target: 'estoque.tabela',
      title: 'Lista de itens',
      body: 'Clique em uma linha para ver o histórico de movimentações e ações (ajustar, transferir).',
    },
  ],
  version: 2,
};