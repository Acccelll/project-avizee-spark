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
        'Comercial: orçamentos, pedidos, conversão e ticket médio.',
        'Financeiro: contas a receber/pagar, inadimplência e saldo.',
        'Fiscal: NF-e emitidas, autorizadas, rejeitadas.',
        'Logística: remessas em andamento e entregas concluídas.',
      ],
    },
    {
      heading: 'Período de análise',
      body: 'O seletor de período no topo (chip global) controla todos os blocos simultaneamente. Use os presets (Hoje, 7d, 30d, Ano) ou um intervalo customizado.',
    },
    {
      heading: 'Drill-down',
      body: 'Clique em qualquer KPI ou linha de tabela para abrir os registros relacionados em drawer lateral, sem perder o contexto do dashboard.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 1', desc: 'Voltar para a Dashboard' },
    { keys: '?', desc: 'Abrir esta ajuda' },
  ],
  related: [
    { label: 'Relatórios', to: '/relatorios' },
    { label: 'Workbook gerencial', to: '/relatorios/workbook-gerencial' },
  ],
  tour: [
    {
      target: 'dashboard.globalPeriod',
      title: 'Período global',
      body: 'Todos os blocos da dashboard respondem a este filtro. Mude aqui para ajustar o intervalo de análise.',
    },
    {
      target: 'dashboard.comercial',
      title: 'Bloco comercial',
      body: 'Resumo de orçamentos, pedidos, conversão e metas. Clique nos números para abrir as listas filtradas.',
    },
    {
      target: 'dashboard.financeiro',
      title: 'Bloco financeiro',
      body: 'Acompanhe recebíveis, pagáveis e o saldo agregado das contas bancárias.',
    },
    {
      target: 'dashboard.fiscal',
      title: 'Bloco fiscal',
      body: 'Status das NF-e emitidas no período. Cores seguem o contrato de status do ERP.',
    },
  ],
  version: 2,
};