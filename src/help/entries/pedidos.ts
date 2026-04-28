import type { HelpEntry } from '../types';

export const pedidosHelp: HelpEntry = {
  route: '/pedidos',
  title: 'Pedidos de venda',
  summary: 'Gestão de pedidos de venda: faturamento (NF-e), separação, expedição e cancelamento controlado.',
  sections: [
    {
      heading: 'Origem',
      body: 'Pedidos podem ser criados manualmente, ou convertidos a partir de um orçamento aprovado. Pedidos vindos de orçamento mantêm vínculo bidirecional para auditoria.',
    },
    {
      heading: 'Faturamento',
      body: 'Use "Faturar" para gerar a NF-e correspondente. O pedido fica em "Faturando" até a SEFAZ autorizar; rejeições retornam o pedido para o estado anterior automaticamente.',
    },
    {
      heading: 'Estoque',
      body: 'A reserva ocorre na criação do pedido; a baixa efetiva ocorre no faturamento. Cancelamentos liberam o estoque reservado.',
    },
    {
      heading: 'Cancelamento',
      body: 'Sempre exige motivo. Pedidos já faturados precisam que a NF-e seja cancelada na SEFAZ antes (regra dos 24h se aplica).',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 3', desc: 'Ir para Pedidos' },
  ],
  related: [
    { label: 'Orçamentos', to: '/orcamentos' },
    { label: 'Fiscal (NF-e)', to: '/fiscal?tipo=saida' },
    { label: 'Logística', to: '/logistica' },
  ],
  tour: [
    {
      target: 'pedidos.filtros',
      title: 'Filtros',
      body: 'Filtre por status, cliente e período. Os status seguem o ciclo de vida documentado neste manual.',
    },
    {
      target: 'pedidos.tabela',
      title: 'Lista de pedidos',
      body: 'Cada linha mostra status com cor padronizada. Abra o drawer para ações como Faturar, Cancelar, Gerar pedido de compra.',
    },
  ],
  version: 1,
};