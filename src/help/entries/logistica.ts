import type { HelpEntry } from '../types';

export const logisticaHelp: HelpEntry = {
  route: '/logistica',
  title: 'Logística',
  summary: 'Remessas de saída, recebimentos de compra e rastreio Correios em uma única tela com 3 abas.',
  sections: [
    {
      heading: 'Remessas',
      body: 'Cada remessa agrupa um ou mais pedidos faturados. Status: Preparando → Em transporte → Entregue / Devolvida.',
    },
    {
      heading: 'Recebimentos',
      body: 'Registre o recebimento de pedidos de compra com conferência de itens. Divergências geram alerta para o comprador.',
    },
    {
      heading: 'Rastreio',
      body: 'A aba Rastreio mostra todas as remessas com código Correios ativo. Atualização automática a cada 6h; manual sob demanda.',
    },
    {
      heading: 'Etiquetas pré-postagem',
      body: 'Gere etiquetas Correios direto do drawer da remessa. O remetente é obtido da configuração da empresa.',
    },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Compras', to: '/pedidos-compra' },
    { label: 'Transportadoras', to: '/transportadoras' },
  ],
  tour: [
    {
      target: 'logistica.tabs',
      title: 'Três áreas integradas',
      body: 'Remessas (saída), Recebimentos (entrada) e Rastreio (Correios). A URL guarda a aba ativa.',
    },
    {
      target: 'logistica.tabela',
      title: 'Lista da aba ativa',
      body: 'Clique em uma linha para ver detalhes e ações específicas do tipo.',
    },
  ],
  version: 2,
};