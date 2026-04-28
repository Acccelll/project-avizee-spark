import type { HelpEntry } from '../types';

/**
 * Lote 2 — manuais sem tour para módulos secundários do ERP.
 * Conteúdo curto e objetivo, focado nas regras essenciais de cada tela.
 */

export const pedidosCompraHelp: HelpEntry = {
  route: '/pedidos-compra',
  title: 'Pedidos de compra',
  summary: 'Emissão e acompanhamento de pedidos de compra junto a fornecedores, com vínculo a cotações e a recebimentos.',
  sections: [
    {
      heading: 'Origem do pedido',
      body: 'Pode ser criado manualmente ou gerado a partir de uma cotação aprovada. Quando vier de cotação, herda fornecedor, prazos e preços já negociados.',
    },
    {
      heading: 'Ciclo de vida',
      body: 'Rascunho → Enviado → Confirmado pelo fornecedor → Recebido (parcial ou total). Cancelamento exige motivo.',
    },
    {
      heading: 'Recebimento',
      body: 'O recebimento ocorre na tela de Logística → Recebimentos. Lá é feita a conferência item-a-item; divergências geram alerta para o comprador.',
    },
    {
      heading: 'Vínculo com NF-e',
      body: 'Após recebimento, vincule a NF de entrada para alimentar estoque e fiscal corretamente. O sistema sugere o pedido pelo CNPJ do fornecedor.',
    },
  ],
  related: [
    { label: 'Cotações de compra', to: '/cotacoes-compra' },
    { label: 'Logística (recebimentos)', to: '/logistica' },
    { label: 'Fornecedores', to: '/fornecedores' },
  ],
  version: 1,
};

export const cotacoesCompraHelp: HelpEntry = {
  route: '/cotacoes-compra',
  title: 'Cotações de compra',
  summary: 'Solicite e compare propostas de fornecedores para um mesmo conjunto de itens antes de gerar o pedido.',
  sections: [
    {
      heading: 'Como funciona',
      body: 'Crie a cotação com a lista de itens, adicione um ou mais fornecedores e registre os preços/prazos recebidos. O sistema permite comparar lado a lado.',
    },
    {
      heading: 'Aprovação',
      body: 'Selecione a melhor proposta (não precisa ser a mais barata) e converta em pedido de compra. O vínculo cotação ↔ pedido fica registrado para auditoria.',
    },
    {
      heading: 'Cancelamento',
      body: 'Cotações sem pedido podem ser canceladas com motivo. Cotações já convertidas só podem ser arquivadas.',
    },
  ],
  related: [
    { label: 'Pedidos de compra', to: '/pedidos-compra' },
    { label: 'Fornecedores', to: '/fornecedores' },
  ],
  version: 1,
};

export const contasBancariasHelp: HelpEntry = {
  route: '/contas-bancarias',
  title: 'Contas bancárias',
  summary: 'Cadastro das contas usadas para baixas financeiras, conciliação e geração de boletos.',
  sections: [
    {
      heading: 'Para que servem',
      body: 'Toda baixa em contas a receber/pagar precisa ser vinculada a uma conta bancária. O saldo é calculado a partir das movimentações financeiras + ajustes manuais.',
    },
    {
      heading: 'Saldo inicial',
      body: 'Ao cadastrar uma conta nova, informe o saldo atual e a data de referência. Movimentações posteriores partem dessa base.',
    },
    {
      heading: 'Inativar',
      body: 'Contas com movimento histórico não podem ser excluídas — apenas inativadas. Inativas não aparecem em novas baixas.',
    },
  ],
  related: [
    { label: 'Financeiro', to: '/financeiro' },
    { label: 'Conciliação', to: '/conciliacao' },
    { label: 'Fluxo de caixa', to: '/fluxo-caixa' },
  ],
  version: 1,
};

export const conciliacaoHelp: HelpEntry = {
  route: '/conciliacao',
  title: 'Conciliação bancária',
  summary: 'Importe extratos OFX e vincule lançamentos bancários a títulos do contas a receber/pagar.',
  sections: [
    {
      heading: 'Importação',
      body: 'Faça upload do arquivo OFX exportado do internet banking. O sistema lê os lançamentos e propõe vínculos com títulos abertos por valor e data.',
    },
    {
      heading: 'Vínculo manual',
      body: 'Lançamentos que não casam automaticamente podem ser vinculados manualmente. Um mesmo título pode ser quitado por múltiplos lançamentos (caso de pagamentos parciais).',
    },
    {
      heading: 'Persistência',
      body: 'Os vínculos ficam gravados — ao reimportar o mesmo extrato, lançamentos já conciliados são reconhecidos e ignorados.',
    },
    {
      heading: 'Não-financeiros',
      body: 'Lançamentos como tarifas, IOF e juros podem ser categorizados em conta contábil sem precisar de título.',
    },
  ],
  related: [
    { label: 'Contas bancárias', to: '/contas-bancarias' },
    { label: 'Financeiro', to: '/financeiro' },
  ],
  version: 1,
};

export const fluxoCaixaHelp: HelpEntry = {
  route: '/fluxo-caixa',
  title: 'Fluxo de caixa',
  summary: 'Projeção de entradas e saídas com base em títulos a receber, a pagar e saldos atuais.',
  sections: [
    {
      heading: 'O que é projetado',
      body: 'Soma o saldo atual das contas + previstos a receber − previstos a pagar, dia a dia, no horizonte selecionado.',
    },
    {
      heading: 'Realizado vs previsto',
      body: 'Títulos quitados aparecem como "realizados". Os demais são "previstos" e usam a data de vencimento. Atrasos puxam para o passado.',
    },
    {
      heading: 'Drill-down',
      body: 'Clique em um dia para ver os títulos que compõem o saldo daquele dia. Útil para identificar concentrações e gargalos.',
    },
  ],
  related: [
    { label: 'Financeiro', to: '/financeiro' },
    { label: 'Contas bancárias', to: '/contas-bancarias' },
  ],
  version: 1,
};

export const relatoriosHelp: HelpEntry = {
  route: '/relatorios',
  title: 'Relatórios',
  summary: 'Relatórios analíticos exportáveis (PDF/Excel) por módulo: vendas, financeiro, estoque, fiscal, compras.',
  sections: [
    {
      heading: 'Filtros',
      body: 'Cada relatório tem seus próprios filtros. O período usa o contrato global (presets ou intervalo customizado).',
    },
    {
      heading: 'Exportação',
      body: 'PDF para apresentação e Excel para análise. O Excel inclui todas as colunas, mesmo as ocultas na tela. Layouts seguem o branding configurado em Administração.',
    },
    {
      heading: 'Favoritos',
      body: 'Marque relatórios como favoritos para acesso rápido. As preferências ficam por usuário.',
    },
  ],
  related: [
    { label: 'Workbook gerencial', to: '/relatorios/workbook-gerencial' },
    { label: 'Apresentação gerencial', to: '/relatorios/apresentacao-gerencial' },
  ],
  version: 1,
};

export const workbookHelp: HelpEntry = {
  route: '/relatorios/workbook-gerencial',
  title: 'Workbook gerencial',
  summary: 'Planilha Excel completa com indicadores gerenciais consolidados, para análise externa e reuniões mensais.',
  sections: [
    {
      heading: 'Modos de geração',
      body: 'Dinâmico: gera com fórmulas e fonte de dados conectada. Fechado: snapshot dos valores no momento da geração, sem dependências externas — ideal para arquivar.',
    },
    {
      heading: 'Conteúdo',
      body: 'Vendas, recebimentos, contas a pagar, fluxo, comparativos por período, ranking de clientes, ranking de produtos e indicadores fiscais.',
    },
    {
      heading: 'Branding',
      body: 'Logo, cores e dados da empresa vêm da configuração centralizada em Administração → Empresa.',
    },
  ],
  related: [
    { label: 'Apresentação gerencial', to: '/relatorios/apresentacao-gerencial' },
    { label: 'Relatórios', to: '/relatorios' },
  ],
  version: 1,
};

export const apresentacaoHelp: HelpEntry = {
  route: '/relatorios/apresentacao-gerencial',
  title: 'Apresentação gerencial',
  summary: 'Apresentação em slides (PPTX) com KPIs e gráficos do período — pronta para reunião de diretoria.',
  sections: [
    {
      heading: 'Geração',
      body: 'Os slides são compostos a partir de templates configuráveis. A mesma fonte de dados do Workbook gerencial é usada — números batem.',
    },
    {
      heading: 'Comentários automáticos',
      body: 'Algumas seções têm comentários sugeridos com base em regras (variações % vs período anterior, metas atingidas). Você pode editar antes de exportar.',
    },
    {
      heading: 'Cadência',
      body: 'É possível agendar geração automática (semanal/mensal) com envio por e-mail aos destinatários cadastrados.',
    },
  ],
  related: [
    { label: 'Workbook gerencial', to: '/relatorios/workbook-gerencial' },
    { label: 'Relatórios', to: '/relatorios' },
  ],
  version: 1,
};

export const fornecedoresHelp: HelpEntry = {
  route: '/fornecedores',
  title: 'Fornecedores',
  summary: 'Cadastro de fornecedores com dados fiscais, contatos, condições de compra e produtos atendidos.',
  sections: [
    {
      heading: 'Cadastro',
      body: 'CNPJ é validado e enriquecido via consulta pública. Endereço usa ViaCEP. Para PF (autônomos), valida CPF.',
    },
    {
      heading: 'Produtos atendidos',
      body: 'Vincule produtos com código no fornecedor, prazo médio e custo. O ERP usa esses dados para sugerir fornecedor em pedidos de compra automáticos.',
    },
    {
      heading: 'Inativar × excluir',
      body: 'Inativos somem das listas de novos pedidos mas mantêm histórico. Exclusão definitiva só para fornecedores sem nenhuma movimentação.',
    },
  ],
  related: [
    { label: 'Pedidos de compra', to: '/pedidos-compra' },
    { label: 'Cotações', to: '/cotacoes-compra' },
  ],
  version: 1,
};