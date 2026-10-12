import type { HelpEntry } from '../types';

/**
 * Lote 2 — manuais aprofundados + tours curtos (2–3 passos) para módulos secundários.
 * Steps usam targets vazios quando não há âncora estável (centralizam no viewport).
 */

export const pedidosCompraHelp: HelpEntry = {
  route: '/pedidos-compra',
  title: 'Pedidos de compra',
  summary: 'Emissão e acompanhamento de pedidos de compra junto a fornecedores, com vínculo a cotações, recebimentos e NF de entrada.',
  sections: [
    {
      heading: 'Estrutura',
      body: 'Tabela de pedidos com filtros por fornecedor, status, data e origem. KPIs no topo somam totais por status. O formulário abre em página própria (itens dinâmicos).',
    },
    {
      heading: 'Origem do pedido',
      body: 'Pode ser criado manualmente, gerado a partir de uma cotação aprovada, ou sugerido automaticamente quando um pedido de venda não tem estoque suficiente. Quando vier de cotação, herda fornecedor, prazos e preços negociados.',
    },
    {
      heading: 'Ciclo de vida',
      body: 'Rascunho → Enviado → Confirmado pelo fornecedor → Recebido (parcial ou total) → Concluído. Cancelamento exige motivo e só é permitido antes de confirmar recebimento.',
    },
    {
      heading: 'Recebimento',
      body: 'Ocorre na tela de Logística → Recebimentos. Conferência item-a-item (qtde recebida vs pedida); divergências geram alerta para o comprador. Confirmar credita estoque automaticamente.',
    },
    {
      heading: 'Vínculo com NF-e',
      body: 'Após recebimento, vincule a NF de entrada (Fiscal → Importar XML). O sistema sugere o pedido pelo CNPJ do fornecedor. Isso fecha o ciclo: estoque + financeiro (gera contas a pagar) + fiscal.',
    },
    {
      heading: 'Permissões',
      body: 'Visualizar: comprador/admin. Criar/editar/cancelar: comprador com escrita. Receber: logística + comprador.',
    },
  ],
  related: [
    { label: 'Cotações de compra', to: '/cotacoes-compra' },
    { label: 'Logística (recebimentos)', to: '/logistica' },
    { label: 'Fornecedores', to: '/fornecedores' },
    { label: 'Fiscal (entrada)', to: '/fiscal?tipo=entrada' },
  ],
  tour: [
    {
      target: '',
      title: 'Pedidos de compra',
      body: 'Esta tela acompanha pedidos de compra a fornecedores. Use os filtros para fatiar por fornecedor, status ou data; clique numa linha para ver itens e histórico.',
    },
    {
      target: '',
      title: 'Origem',
      body: 'Pedidos podem ser criados manualmente, vir de uma cotação aprovada, ou ser sugeridos a partir de um pedido de venda sem estoque (ação "Gerar pedido de compra" no pedido).',
    },
    {
      target: '',
      title: 'Receber em Logística',
      body: 'O recebimento acontece na aba Recebimentos da Logística. Lá você confere item-a-item; ao confirmar, o estoque é creditado automaticamente.',
    },
  ],
  version: 2,
};

export const cotacoesCompraHelp: HelpEntry = {
  route: '/cotacoes-compra',
  title: 'Cotações de compra',
  summary: 'Solicite e compare propostas de fornecedores para um mesmo conjunto de itens antes de gerar o pedido.',
  sections: [
    {
      heading: 'Como funciona',
      body: 'Crie a cotação com a lista de itens, adicione um ou mais fornecedores e registre os preços/prazos recebidos de cada um. O sistema permite comparar lado a lado.',
    },
    {
      heading: 'Comparação',
      body: 'Visualize fornecedores em colunas com total por proposta + ranking automático por melhor preço unitário e prazo. Justifique a escolha (não precisa ser a mais barata).',
    },
    {
      heading: 'Aprovação e conversão',
      body: 'Selecione a melhor proposta e converta em pedido de compra. O vínculo cotação ↔ pedido fica registrado para auditoria. A cotação fica "Convertida" e não pode mais ser editada.',
    },
    {
      heading: 'Cancelamento',
      body: 'Cotações sem pedido podem ser canceladas com motivo. Cotações já convertidas só podem ser arquivadas (preserva histórico).',
    },
  ],
  related: [
    { label: 'Pedidos de compra', to: '/pedidos-compra' },
    { label: 'Fornecedores', to: '/fornecedores' },
  ],
  tour: [
    {
      target: '',
      title: 'Cotações',
      body: 'Crie uma cotação, adicione itens e fornecedores, registre preços e prazos. O sistema compara lado a lado e ranqueia automaticamente.',
    },
    {
      target: '',
      title: 'Conversão em pedido',
      body: 'Aprove a melhor proposta e converta em pedido de compra. O vínculo fica registrado e a cotação não pode mais ser editada.',
    },
  ],
  version: 2,
};

export const contasBancariasHelp: HelpEntry = {
  route: '/contas-bancarias',
  title: 'Contas bancárias',
  summary: 'Cadastro das contas usadas para baixas financeiras, conciliação e geração de boletos. Saldo calculado a partir das movimentações.',
  sections: [
    {
      heading: 'Para que servem',
      body: 'Toda baixa em contas a receber/pagar precisa ser vinculada a uma conta bancária. O saldo é calculado a partir das movimentações financeiras + ajustes manuais + saldo inicial.',
    },
    {
      heading: 'Saldo inicial',
      body: 'Ao cadastrar uma conta nova, informe o saldo atual e a data de referência. Movimentações posteriores partem dessa base. Não inclua extrato anterior à data — o sistema considera só o que vem depois.',
    },
    {
      heading: 'Tipos de conta',
      body: 'Conta corrente, poupança, caixa interno e cartão. O tipo afeta apresentação e relatórios mas não regras operacionais.',
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
  version: 2,
};

export const conciliacaoHelp: HelpEntry = {
  route: '/conciliacao',
  title: 'Conciliação bancária',
  summary: 'Importe extratos OFX e vincule lançamentos bancários a títulos do contas a receber/pagar — automaticamente quando possível.',
  sections: [
    {
      heading: 'Importação OFX',
      body: 'Faça upload do arquivo OFX exportado do internet banking. O sistema lê os lançamentos, identifica os já conciliados (não duplica) e propõe vínculos com títulos abertos por valor + data próxima.',
    },
    {
      heading: 'Vínculo automático',
      body: 'Lançamentos com match único (mesmo valor + data próxima ao vencimento) ficam pré-vinculados. Você só precisa confirmar em massa.',
    },
    {
      heading: 'Vínculo manual',
      body: 'Lançamentos sem match podem ser vinculados manualmente. Um mesmo título pode ser quitado por múltiplos lançamentos (caso de pagamentos parciais ou taxas).',
    },
    {
      heading: 'Lançamentos não-financeiros',
      body: 'Tarifas, IOF, juros e rendimentos podem ser categorizados em conta contábil sem precisar de título. Essas categorizações ficam em catálogo para reuso.',
    },
    {
      heading: 'Persistência',
      body: 'Os vínculos ficam gravados — ao reimportar o mesmo extrato, lançamentos já conciliados são reconhecidos e ignorados. Garante que rodar de novo não duplica nada.',
    },
  ],
  related: [
    { label: 'Contas bancárias', to: '/contas-bancarias' },
    { label: 'Financeiro', to: '/financeiro' },
  ],
  tour: [
    {
      target: '',
      title: 'Conciliação',
      body: 'Importe o OFX do banco. O sistema casa automaticamente o que dá match único e propõe sugestões para o resto.',
    },
    {
      target: '',
      title: 'Categorize tarifas e IOF',
      body: 'Lançamentos sem título (tarifas, juros, rendimentos) podem ser categorizados em conta contábil. Eles entram no fluxo de caixa sem virar título.',
    },
  ],
  version: 2,
};

export const fluxoCaixaHelp: HelpEntry = {
  route: '/fluxo-caixa',
  title: 'Fluxo de caixa',
  summary: 'Projeção de entradas e saídas com base em títulos a receber, a pagar e saldos atuais — dia a dia, no horizonte selecionado.',
  sections: [
    {
      heading: 'O que é projetado',
      body: 'Saldo atual das contas + previstos a receber − previstos a pagar, dia a dia. O horizonte (7d, 30d, 90d, ano) é configurável no chip de período.',
    },
    {
      heading: 'Realizado vs previsto',
      body: 'Títulos quitados aparecem como "realizados" (no dia da baixa). Os demais são "previstos" e usam a data de vencimento. Atrasos aparecem retroativamente — útil para identificar rolagem.',
    },
    {
      heading: 'Drill-down',
      body: 'Clique em um dia para ver os títulos que compõem o saldo daquele dia (a receber e a pagar). Útil para identificar concentrações de pagamento e gargalos de caixa.',
    },
    {
      heading: 'Exportação',
      body: 'Exporte para Excel para análise externa. Inclui realizado, previsto e saldo projetado por dia.',
    },
  ],
  related: [
    { label: 'Financeiro', to: '/financeiro' },
    { label: 'Contas bancárias', to: '/contas-bancarias' },
    { label: 'Conciliação', to: '/conciliacao' },
  ],
  tour: [
    {
      target: '',
      title: 'Fluxo de caixa',
      body: 'Projeção dia a dia somando saldo atual + recebíveis − pagáveis. Use o chip de período no topo para ajustar o horizonte.',
    },
    {
      target: '',
      title: 'Drill por dia',
      body: 'Clique em qualquer barra/dia para abrir os títulos que compõem o saldo daquele dia — útil para identificar concentrações.',
    },
  ],
  version: 2,
};

export const relatoriosHelp: HelpEntry = {
  route: '/relatorios',
  title: 'Relatórios',
  summary: 'Relatórios analíticos exportáveis (PDF/Excel) por módulo: vendas, financeiro, estoque, fiscal e compras.',
  sections: [
    {
      heading: 'Catálogo',
      body: 'Os relatórios são organizados por módulo. Os mais usados são marcáveis como favoritos para acesso rápido (chip "Favoritos" no topo).',
    },
    {
      heading: 'Filtros',
      body: 'Cada relatório tem seus próprios filtros. O período usa o contrato global (presets ou intervalo customizado). Filtros ficam persistidos por usuário e relatório.',
    },
    {
      heading: 'Exportação',
      body: 'PDF para apresentação (com branding) e Excel para análise (com fórmulas quando aplicável). O Excel inclui todas as colunas, mesmo as ocultas na visualização.',
    },
    {
      heading: 'Branding',
      body: 'Logo, cores e dados da empresa vêm da configuração centralizada em Administração → Empresa. Mudanças refletem em todos os relatórios automaticamente.',
    },
    {
      heading: 'Fechamento do mês',
      body: 'Para reuniões mensais, use a página Fechamento do mês: o Workbook (Excel) e a apresentação (PPTX) saem dos mesmos dados.',
    },
  ],
  related: [
    { label: 'Fechamento do mês', to: '/relatorios/fechamento' },
  ],
  tour: [
    {
      target: '',
      title: 'Relatórios',
      body: 'Catálogo organizado por módulo. Filtros por relatório, período global no topo. Marque favoritos para acesso rápido.',
    },
    {
      target: '',
      title: 'PDF × Excel',
      body: 'PDF para apresentação (com branding) e Excel para análise. O Excel sempre inclui todas as colunas, inclusive ocultas.',
    },
  ],
  version: 2,
};

export const workbookHelp: HelpEntry = {
  route: '/relatorios/workbook-gerencial/modelo-antigo',
  title: 'Workbook gerencial (modelo antigo)',
  summary: 'Planilha do modelo antigo, com DRE, vendas por vendedor e funil. O Workbook de Fechamento fica em Fechamento do mês.',
  sections: [
    {
      heading: 'Modos de geração',
      body: 'Dinâmico: gera com fórmulas e fonte de dados conectada — números mudam quando o ERP muda. Fechado: snapshot dos valores no momento da geração, sem dependências externas — ideal para arquivar.',
    },
    {
      heading: 'Quando usar',
      body: 'Para as abas que só existem neste modelo (DRE, vendas por vendedor, funil). Para o fechamento do mês, use o Workbook de Fechamento.',
    },
  ],
  related: [
    { label: 'Fechamento do mês', to: '/relatorios/fechamento' },
    { label: 'Relatórios', to: '/relatorios' },
  ],
  version: 3,
};

export const fechamentoHelp: HelpEntry = {
  route: '/relatorios/fechamento',
  title: 'Fechamento do mês',
  summary: 'Uma página para o fechamento: entradas do mês, pendências, a apresentação em .pptx e o Workbook em .xlsx, com os mesmos números.',
  sections: [
    {
      heading: 'Três passos',
      body: 'Escolha o mês (a página abre no último mês fechado), confira as pendências e as entradas do fechamento e baixe o Workbook e a apresentação. A versão da apresentação sugerida para o mês já vem marcada.',
    },
    {
      heading: 'Entradas do fechamento',
      body: 'Informe o caixa disponível do extrato e o bloqueado em garantia: o caixa do mês é a soma dos dois, e a diferença para o calculado pelo ERP aparece como ajuste ao extrato. Seguidores aceitam só números inteiros (4.012) e a página avisa quando o número cai mais da metade ou mais que triplica. Os parâmetros do ano (meta e limite de faturamento) ficam logo abaixo.',
    },
    {
      heading: 'Workbook',
      body: '12 abas com a marca AviZee: Resumo (indicadores e conferências), Resultado, Faturamento, Caixa, Despesas, Clientes, Estados, Capital de giro, Estoque, Sócios, Redes e Dados. As abas calculam a partir da aba Dados e o arquivo já abre preenchido. Valores em R$ sem centavos; os centavos estão na aba Dados.',
    },
    {
      heading: 'De onde vêm os números',
      body: 'Faturamento pelas notas emitidas, caixa pelos recebimentos e pagamentos, capital de giro e estoque no fim do mês. O detalhe por cliente, estado e categoria reparte esses totais; o Resumo do Workbook confere que as somas batem.',
    },
    {
      heading: 'Apresentação',
      body: 'Cada slide tem um título que conclui e até três comentários com fatos. Clique no slide para editar o título e os comentários, ou para ocultá-lo. "Marcar como final" congela números e textos e guarda o .pptx no histórico.',
    },
    {
      heading: 'Mais opções',
      body: 'Na engrenagem: a geração automática da apresentação (administradores) e o Workbook gerencial do modelo antigo.',
    },
  ],
  related: [
    { label: 'Workbook gerencial (modelo antigo)', to: '/relatorios/workbook-gerencial/modelo-antigo' },
    { label: 'Relatórios', to: '/relatorios' },
  ],
  tour: [
    {
      target: '',
      title: 'Fechamento do mês',
      body: 'Escolha o mês, confira as entradas e baixe o Workbook e a apresentação. Os dois usam os mesmos dados.',
    },
    {
      target: '',
      title: 'Edite no próprio slide',
      body: 'Clique em um slide para mudar o título e os comentários, ou para ocultá-lo do deck.',
    },
  ],
  version: 4,
};

export const fornecedoresHelp: HelpEntry = {
  route: '/fornecedores',
  title: 'Fornecedores',
  summary: 'Cadastro de fornecedores com dados fiscais, contatos, condições de compra e produtos atendidos.',
  sections: [
    {
      heading: 'Cadastro com enriquecimento',
      body: 'CNPJ é validado e enriquecido automaticamente via consulta pública (razão social, endereço, IE). Endereço usa ViaCEP para preenchimento. Para PF (autônomos), valida CPF.',
    },
    {
      heading: 'Abas do cadastro',
      body: 'Geral (dados cadastrais), Endereços, Contatos, Comercial (condições padrão de compra) e Produtos atendidos.',
    },
    {
      heading: 'Produtos atendidos',
      body: 'Vincule produtos com código no fornecedor, prazo médio de entrega e custo. O ERP usa esses dados para sugerir fornecedor em pedidos de compra automáticos quando o estoque cai abaixo do mínimo.',
    },
    {
      heading: 'Condições de compra',
      body: 'Forma de pagamento padrão e prazo. Vão automaticamente para os pedidos de compra criados a partir do fornecedor.',
    },
    {
      heading: 'Inativar × Excluir',
      body: 'Inativos somem das listas de novos pedidos mas mantêm histórico. Exclusão definitiva só para fornecedores sem nenhuma movimentação. Recomendado sempre Inativar.',
    },
  ],
  related: [
    { label: 'Pedidos de compra', to: '/pedidos-compra' },
    { label: 'Cotações', to: '/cotacoes-compra' },
    { label: 'Fiscal (entrada)', to: '/fiscal?tipo=entrada' },
  ],
  tour: [
    {
      target: '',
      title: 'Fornecedores',
      body: 'Cadastro com enriquecimento por CNPJ + ViaCEP. Vincule produtos atendidos com código, prazo e custo — usado em pedidos de compra automáticos.',
    },
  ],
  version: 2,
};
