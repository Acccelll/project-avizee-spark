import type { HelpEntry } from '../types';

export const financeiroHelp: HelpEntry = {
  route: '/financeiro',
  title: 'Financeiro',
  summary: 'Contas a receber e a pagar, baixas (totais e parciais), conciliação bancária, fluxo de caixa e calendário de vencimentos.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'No topo: período + alternância Lista/Calendário + Exportar + Novo Lançamento. Abaixo: 5 KPIs clicáveis (A Vencer, Vence Hoje, Vencidos, Parciais, Pagos) e a tabela com filtros avançados.',
    },
    {
      heading: 'Visualizações',
      body: 'Lista: tabela tradicional com seleção em massa para baixa em lote. Calendário: títulos plotados por data de vencimento, com totalização diária — ideal para gestão de fluxo.',
    },
    {
      heading: 'Status de título',
      body: 'Em aberto, Vencido, Parcial (baixa parcial), Quitado (pago) e Cancelado. Títulos parciais foram baixados parcialmente — o saldo restante mantém a data de vencimento original.',
    },
    {
      heading: 'KPIs clicáveis',
      body: 'Cada card filtra a tabela: A Vencer (status "aberto"), Vence Hoje (banner mobile + filtro), Vencidos (status "vencido"), Parciais (status "parcial") e Pagos (status "pago"). Clique para focar.',
    },
    {
      heading: 'Baixas',
      body: 'Use "Baixar" na linha (ou em massa) para registrar pagamento total ou parcial. Vincule à conta bancária correta — é isso que alimenta a conciliação. Você pode baixar em valor diferente do título (gera diferença que pode virar título novo ou ser categorizada).',
    },
    {
      heading: 'Estorno',
      body: 'Estornar reverte uma baixa. O título volta ao status anterior e a movimentação bancária é desfeita. A operação fica em auditoria.',
    },
    {
      heading: 'Cancelar título',
      body: 'Exige motivo. Títulos vinculados a NF-e autorizada exigem cancelar a NF antes. Cancelado é diferente de excluído — fica para auditoria.',
    },
    {
      heading: 'Novo lançamento',
      body: 'Modal com tipo (Receber/Pagar), pessoa (cliente/fornecedor), descrição, vencimento, valor, conta bancária, forma de pagamento e categoria contábil. Pode gerar parcelas automáticas.',
    },
    {
      heading: 'Origem do título',
      body: 'A coluna Origem mostra de onde veio o título: Faturamento de pedido (NF X), Recebimento de compra, Lançamento manual, Importação. Clique para abrir o documento de origem.',
    },
    {
      heading: 'Conciliação bancária',
      body: 'Importe extratos OFX em "Conciliação" e vincule lançamentos a títulos automaticamente (por valor + data). Vínculos ficam persistidos — reimportar o mesmo OFX não duplica.',
    },
    {
      heading: 'Permissões',
      body: 'Ver títulos: financeiro/admin. Baixar/estornar/cancelar: financeiro com permissão de escrita. Vendedores normalmente só veem os títulos dos próprios clientes.',
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
      target: 'financeiro.viewToggle',
      title: 'Lista × Calendário',
      body: 'Alterne entre lista tradicional e visualização em calendário (totalização diária por vencimento). A escolha é persistida.',
    },
    {
      target: 'financeiro.kpis',
      title: 'KPIs clicáveis',
      body: 'Cada card filtra a tabela. A Vencer, Vencidos e Parciais são os mais usados no dia a dia. Em mobile, "Vence Hoje" vira banner acima dos cards.',
    },
    {
      target: 'financeiro.filtros',
      title: 'Filtros avançados',
      body: 'Filtre por Tipo (Receber/Pagar), Status, Banco e Origem. A busca cobre descrição, pessoa, banco e forma de pagamento.',
    },
    {
      target: 'financeiro.tabela',
      title: 'Títulos',
      body: 'Cores indicam status. Selecione múltiplos para baixa em lote. Clique numa linha para abrir o drawer com origem, baixas anteriores e ações.',
    },
    {
      target: '',
      title: 'Baixar título',
      body: 'A ação "Baixar" registra o pagamento (total ou parcial), vinculando à conta bancária. Esse vínculo é o que permite conciliação automática depois.',
    },
    {
      target: '',
      title: 'Estornar e cancelar',
      body: 'Estornar reverte uma baixa (título volta ao status anterior). Cancelar exige motivo e é definitivo — use para títulos lançados por engano.',
    },
    {
      target: 'financeiro.novoBtn',
      title: 'Novo lançamento',
      body: 'Abre o modal para criar título manual com pessoa, vencimento, valor, conta, forma de pagamento e categoria. Pode gerar parcelas automáticas.',
    },
    {
      target: '',
      title: 'Conciliação relacionada',
      body: 'Para casar lançamentos do banco com títulos automaticamente, vá em Conciliação Bancária e importe o OFX. Os vínculos ficam persistidos.',
    },
  ],
  version: 3,
};
