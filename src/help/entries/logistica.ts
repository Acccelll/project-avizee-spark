import type { HelpEntry } from '../types';

export const logisticaHelp: HelpEntry = {
  route: '/logistica',
  title: 'Logística',
  summary: 'Entregas, recebimentos de compra e remessas (com rastreio Correios e etiquetas pré-postagem) em uma única tela com 3 abas.',
  sections: [
    {
      heading: 'Três áreas integradas',
      body: 'Entregas (visão consolidada por pedido), Recebimentos (compras chegando) e Remessas (operação de despacho). A URL guarda a aba ativa para deep-linking.',
    },
    {
      heading: 'Entregas',
      body: 'Visão por pedido faturado. Quando há múltiplas remessas para o mesmo pedido, o status exibido reflete a última atualização — para precisão por embalagem, vá na aba Remessas.',
    },
    {
      heading: 'Remessas',
      body: 'Cada remessa agrupa um ou mais pedidos faturados. Status: Preparando → Postado → Em transporte → Entregue / Devolvida. Cada transição grava evento.',
    },
    {
      heading: 'Drawer da remessa',
      body: 'Abas: Geral (transportadora, valor de frete, peso), Itens (volumes), Eventos (timeline Correios), Etiqueta (PDF pré-postagem). Ações: Atualizar rastreio, Imprimir etiqueta, Marcar entregue manualmente.',
    },
    {
      heading: 'Rastreio Correios',
      body: 'Atualização automática a cada 6h via cron interno. Manual sob demanda pelo botão "Atualizar Rastreios" (em massa) ou dentro do drawer (individual). Eventos vêm da API oficial.',
    },
    {
      heading: 'Etiquetas pré-postagem',
      body: 'Gere etiquetas Correios direto do drawer da remessa. O remetente é obtido da configuração da empresa (Administração → Empresa). Etiquetas ficam persistidas em `remessa_etiquetas` no bucket `etiquetas-correios`.',
    },
    {
      heading: 'Recebimentos',
      body: 'Aba para registrar o recebimento de pedidos de compra com conferência de itens (quantidade recebida vs pedida). Divergências geram alerta para o comprador. Após confirmar, o estoque é creditado automaticamente.',
    },
    {
      heading: 'Vincular NF de entrada',
      body: 'Após recebimento, vincule a NF-e do fornecedor (em Fiscal → Importar XML). O sistema sugere o pedido pelo CNPJ. Isso fecha o ciclo fiscal/estoque/financeiro.',
    },
    {
      heading: 'Permissões',
      body: 'Visualizar: todos. Editar (criar remessa, marcar entregue, registrar recebimento): logística com permissão de escrita. Em modo somente-leitura, banner avisa no topo.',
    },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Compras', to: '/pedidos-compra' },
    { label: 'Transportadoras', to: '/transportadoras' },
    { label: 'Fiscal (entrada)', to: '/fiscal?tipo=entrada' },
  ],
  tour: [
    {
      target: 'logistica.tabs',
      title: 'Três áreas integradas',
      body: 'Entregas (saída por pedido), Recebimentos (entrada de compras) e Remessas (operação granular). A URL guarda a aba ativa.',
    },
    {
      target: 'logistica.tabela',
      title: 'Lista da aba ativa',
      body: 'Filtros e métricas se ajustam à aba escolhida. Clique numa linha para ver detalhes e ações específicas.',
    },
    {
      target: 'logistica.bulkRastrear',
      title: 'Atualizar rastreios em massa',
      body: 'Dispara consulta aos Correios para todas as remessas com código ativo. Atualização também roda automaticamente a cada 6h.',
    },
    {
      target: '',
      title: 'Drawer da remessa',
      body: 'Clique em uma remessa para ver eventos Correios, itens, gerar etiqueta pré-postagem e marcar transições manuais (postado → trânsito → entregue) quando necessário.',
    },
    {
      target: '',
      title: 'Etiqueta pré-postagem',
      body: 'No drawer, "Imprimir etiqueta" gera o PDF dos Correios usando o remetente cadastrado em Empresa. Etiquetas ficam persistidas para reimpressão.',
    },
    {
      target: '',
      title: 'Recebimento de compra',
      body: 'Na aba Recebimentos, clique no pedido de compra para conferir item-a-item. Divergências alertam o comprador. Confirmar credita o estoque.',
    },
  ],
  version: 3,
};
