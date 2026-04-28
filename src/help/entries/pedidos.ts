import type { HelpEntry } from '../types';

export const pedidosHelp: HelpEntry = {
  route: '/pedidos',
  title: 'Pedidos de venda',
  summary: 'Gestão de pedidos: faturamento (NF-e), separação, expedição, geração de pedidos de compra e cancelamento controlado.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'KPIs (total, valor, em andamento, atrasados) no topo, filtros avançados (status, faturamento, cliente, prazo, datas) e a tabela. A criação de pedidos manuais ocorre dentro do drawer ou via conversão de orçamento.',
    },
    {
      heading: 'Origem',
      body: 'Pedidos podem ser criados manualmente, ou convertidos a partir de um orçamento aprovado. Pedidos vindos de orçamento mantêm vínculo bidirecional para auditoria — alterações posteriores não voltam ao orçamento.',
    },
    {
      heading: 'Ciclo de vida',
      body: 'Aguardando faturamento → Faturando → Faturado → Em separação → Em transporte → Entregue. Em paralelo, controle financeiro (títulos gerados) e logístico (remessas).',
    },
    {
      heading: 'Faturamento (NF-e)',
      body: 'Use "Faturar" para gerar a NF-e correspondente. O pedido fica em "Faturando" até a SEFAZ autorizar; rejeições retornam o pedido ao estado anterior automaticamente. Sucesso gera títulos no Financeiro conforme a forma de pagamento.',
    },
    {
      heading: 'Estoque',
      body: 'A reserva ocorre na criação do pedido (sem baixa). A baixa efetiva ocorre no faturamento. Cancelamentos liberam o estoque reservado.',
    },
    {
      heading: 'Pedido de compra automático',
      body: 'Para itens sem estoque suficiente, é possível gerar um pedido de compra sugerido com base nos fornecedores cadastrados no produto.',
    },
    {
      heading: 'Cancelamento',
      body: 'Sempre exige motivo. Pedidos já faturados precisam que a NF-e seja cancelada na SEFAZ antes (regra dos 24h se aplica). Após o prazo, apenas devolução é possível.',
    },
    {
      heading: 'Drawer de detalhes',
      body: 'Abas: Geral (cliente, condições), Itens, Financeiro (títulos gerados), Logística (remessas), Histórico (timeline de status). Cada aba respeita as suas permissões.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 3', desc: 'Ir para Pedidos' },
  ],
  related: [
    { label: 'Orçamentos', to: '/orcamentos' },
    { label: 'Fiscal (NF-e)', to: '/fiscal?tipo=saida' },
    { label: 'Logística', to: '/logistica' },
    { label: 'Financeiro', to: '/financeiro' },
  ],
  tour: [
    {
      target: 'pedidos.filtros',
      title: 'Filtros',
      body: 'Filtre por status, faturamento, cliente, prazo de despacho e período. Os status seguem o ciclo de vida descrito no manual.',
    },
    {
      target: 'pedidos.tabela',
      title: 'Lista de pedidos',
      body: 'Cada linha mostra status com cor padronizada. Clique para abrir o drawer de detalhes com abas de itens, financeiro, logística e histórico.',
    },
    {
      target: '',
      title: 'Ações por linha',
      body: 'A partir da linha você pode Faturar, Cancelar (com motivo), Gerar pedido de compra para itens em falta e Imprimir confirmação.',
    },
    {
      target: '',
      title: 'Faturar pedido',
      body: 'A ação "Faturar" abre o assistente de NF-e. Após autorização SEFAZ, o pedido vira "Faturado" e os títulos são gerados no Financeiro automaticamente.',
    },
    {
      target: '',
      title: 'Cancelamento controlado',
      body: 'Cancelar exige motivo obrigatório. Se o pedido já foi faturado, primeiro cancele a NF-e em Fiscal (24h SEFAZ); depois cancele o pedido.',
    },
  ],
  version: 2,
};
