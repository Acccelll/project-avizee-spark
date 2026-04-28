import type { HelpEntry } from '../types';

export const financeiroHelp: HelpEntry = {
  route: '/financeiro',
  title: 'Financeiro',
  summary: 'Contas a receber e a pagar, baixas, conciliação bancária e fluxo de caixa.',
  sections: [
    {
      heading: 'Títulos',
      body: 'Cada título tem status: Em aberto, Parcial, Quitado, Cancelado, Vencido. Títulos parciais foram baixados parcialmente — o saldo restante mantém a data de vencimento original.',
    },
    {
      heading: 'Baixas',
      body: 'Use "Baixar" para registrar pagamento total ou parcial. Vincule à conta bancária correta para alimentar a conciliação.',
    },
    {
      heading: 'Estorno',
      body: 'Estornar reverte uma baixa. O título volta ao status anterior e a movimentação bancária é desfeita.',
    },
    {
      heading: 'Conciliação',
      body: 'Importe extratos OFX em "Conciliação" e vincule lançamentos a títulos automaticamente. Vínculos ficam persistidos.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + 6', desc: 'Ir para Financeiro' },
  ],
  related: [
    { label: 'Contas bancárias', to: '/contas-bancarias' },
    { label: 'Conciliação', to: '/conciliacao' },
    { label: 'Fluxo de caixa', to: '/fluxo-caixa' },
  ],
  tour: [
    {
      target: 'financeiro.tipoTabs',
      title: 'Receber × Pagar',
      body: 'Alterne entre contas a receber e a pagar. Cada aba tem ações específicas.',
    },
    {
      target: 'financeiro.tabela',
      title: 'Títulos',
      body: 'Cores indicam status. Use ações na linha para baixar, estornar, editar ou cancelar.',
    },
  ],
  version: 1,
};