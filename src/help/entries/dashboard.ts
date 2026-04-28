import type { HelpEntry } from '../types';

export const dashboardHelp: HelpEntry = {
  route: '/',
  title: 'Dashboard',
  summary: 'Visão executiva consolidada do ERP — KPIs comerciais, financeiros, fiscais e logísticos no período selecionado.',
  sections: [
    {
      heading: 'O que é exibido',
      body: 'A dashboard agrega indicadores das principais áreas operacionais. Cada bloco é independente e respeita as suas permissões — você só vê o que pode acessar.',
      bullets: [
        'Comercial: orçamentos abertos, pedidos do período, taxa de conversão e ticket médio.',
        'Financeiro: a receber, a pagar, vencidos, saldo bancário e inadimplência.',
        'Fiscal: NF-e emitidas, autorizadas, rejeitadas e pendentes na SEFAZ.',
        'Logística: remessas em andamento, entregas concluídas, atrasadas e compras aguardando recebimento.',
      ],
    },
    {
      heading: 'Período de análise',
      body: 'O chip global no topo controla todos os blocos simultaneamente. Use os presets (Hoje, 7d, 15d, 30d, 90d, Ano) ou um intervalo customizado. A escolha é persistida por usuário e respeita o contrato global de períodos.',
    },
    {
      heading: 'Drill-down',
      body: 'Clique em qualquer KPI, número ou linha de tabela para abrir os registros relacionados em drawer lateral, sem perder o contexto do dashboard. Drill-downs respeitam o período global e os filtros do bloco.',
    },
    {
      heading: 'Layout e personalização',
      body: 'A ordem dos blocos pode ser ajustada em Configurações → Aparência → Dashboard. Em mobile, blocos secundários ficam recolhidos por padrão para reduzir scroll — toque para expandir.',
    },
    {
      heading: 'Atalhos',
      body: 'Pressione "?" a qualquer momento para abrir esta ajuda contextual. Use os atalhos numéricos (Ctrl/Cmd + 1..9) para saltar entre módulos.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 1', desc: 'Voltar para a Dashboard' },
    { keys: '?', desc: 'Abrir esta ajuda' },
    { keys: 'Ctrl/Cmd + K', desc: 'Busca global' },
  ],
  related: [
    { label: 'Relatórios', to: '/relatorios' },
    { label: 'Workbook gerencial', to: '/relatorios/workbook-gerencial' },
    { label: 'Apresentação gerencial', to: '/relatorios/apresentacao-gerencial' },
  ],
  tour: [
    {
      target: 'dashboard.globalPeriod',
      title: 'Período global',
      body: 'Todos os blocos respondem a este filtro. Use os presets ou um intervalo customizado para ajustar a janela de análise.',
    },
    {
      target: 'dashboard.comercial',
      title: 'Bloco comercial',
      body: 'Orçamentos, pedidos, conversão e meta. Clique em qualquer número para abrir a lista filtrada — ex.: "8 orçamentos aprovados" → drawer com as linhas.',
    },
    {
      target: 'dashboard.financeiro',
      title: 'Bloco financeiro',
      body: 'A receber, a pagar, vencidos e saldo bancário. Os cards de "vencidos" e "vence hoje" são clicáveis e te levam direto ao Financeiro filtrado.',
    },
    {
      target: 'dashboard.fiscal',
      title: 'Bloco fiscal',
      body: 'NF-e do período por status SEFAZ. Cores seguem o contrato de status do ERP — vermelho para rejeição, âmbar para pendência.',
    },
    {
      target: 'dashboard.logistica',
      title: 'Bloco logística',
      body: 'Remessas em transporte, atrasadas e compras aguardando. Drill-down abre a aba correspondente em Logística.',
    },
    {
      target: '',
      title: 'Drill-down em qualquer KPI',
      body: 'Esta é uma dica conceitual: praticamente todo número ou badge da dashboard é clicável e abre um drawer com os registros que compõem aquele indicador. Tente.',
    },
  ],
  version: 3,
};
