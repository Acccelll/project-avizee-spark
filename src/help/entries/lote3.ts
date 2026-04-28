import type { HelpEntry } from '../types';

/**
 * Lote 3 — manuais curtos para cadastros auxiliares.
 * Sem tour guiado: telas simples, conceitualmente diretas.
 */

export const transportadorasHelp: HelpEntry = {
  route: '/transportadoras',
  title: 'Transportadoras',
  summary: 'Cadastro das transportadoras usadas em remessas e geração de etiquetas de frete.',
  sections: [
    {
      heading: 'Uso',
      body: 'Vincule a transportadora padrão ao cliente para sugerir automaticamente nas remessas. Para Correios, configure os serviços disponíveis (PAC, SEDEX) e contrato.',
    },
    {
      heading: 'Etiquetas',
      body: 'A geração de etiquetas pré-postagem dos Correios usa o remetente cadastrado em Empresa (Administração) e a transportadora vinculada à remessa.',
    },
  ],
  related: [
    { label: 'Logística', to: '/logistica' },
    { label: 'Clientes', to: '/clientes' },
  ],
  version: 1,
};

export const funcionariosHelp: HelpEntry = {
  route: '/funcionarios',
  title: 'Funcionários',
  summary: 'Cadastro de funcionários para vínculo com vendas, comissões e responsabilidade por documentos.',
  sections: [
    {
      heading: 'Funções',
      body: 'Cada funcionário tem função (vendedor, comprador, financeiro, etc) que define em quais campos ele pode ser selecionado nos formulários do ERP.',
    },
    {
      heading: 'Vínculo com usuário',
      body: 'Funcionários podem ter um usuário do sistema vinculado, permitindo login. As permissões do usuário são gerenciadas em Administração → Usuários.',
    },
    {
      heading: 'Comissões',
      body: 'Vendedores podem ter regra de comissão (% sobre venda ou faixa por meta). O cálculo aparece nos relatórios comerciais.',
    },
  ],
  related: [
    { label: 'Administração', to: '/administracao' },
  ],
  version: 1,
};

export const sociosHelp: HelpEntry = {
  route: '/socios',
  title: 'Sócios e participações',
  summary: 'Cadastro do quadro societário com participações percentuais por sócio.',
  sections: [
    {
      heading: 'Sócios',
      body: 'Pessoas físicas ou jurídicas. CPF/CNPJ é validado. A aba Participações controla o % de cada sócio na empresa.',
    },
    {
      heading: 'Participações',
      body: 'A soma das participações ativas deve ser 100%. Mudanças geram histórico para auditoria — útil em alterações contratuais.',
    },
  ],
  related: [
    { label: 'Empresa', to: '/configuracoes' },
  ],
  version: 1,
};

export const formasPagamentoHelp: HelpEntry = {
  route: '/formas-pagamento',
  title: 'Formas de pagamento',
  summary: 'Catálogo de formas de pagamento (à vista, boleto, cartão, parcelado) usadas em orçamentos, pedidos e baixas financeiras.',
  sections: [
    {
      heading: 'Configuração',
      body: 'Cada forma define: número de parcelas, intervalo entre parcelas, conta bancária default e taxa (quando aplicável).',
    },
    {
      heading: 'Geração de títulos',
      body: 'Ao faturar um pedido com a forma escolhida, o sistema gera automaticamente os títulos a receber com as datas corretas.',
    },
    {
      heading: 'Inativar',
      body: 'Formas com histórico não podem ser excluídas. Inativas somem das opções em novos documentos.',
    },
  ],
  related: [
    { label: 'Financeiro', to: '/financeiro' },
    { label: 'Clientes', to: '/clientes' },
  ],
  version: 1,
};

export const gruposEconomicosHelp: HelpEntry = {
  route: '/grupos-economicos',
  title: 'Grupos econômicos',
  summary: 'Agrupamento de clientes que pertencem ao mesmo grupo empresarial — usado em condições comerciais e relatórios consolidados.',
  sections: [
    {
      heading: 'Para que serve',
      body: 'Permite aplicar tabela de preço, desconto máximo e prazo de pagamento por grupo (vence sobre tabela base, mas perde para condição específica do cliente).',
    },
    {
      heading: 'Relatórios',
      body: 'Relatórios comerciais oferecem visão consolidada por grupo, somando todas as empresas vinculadas.',
    },
  ],
  related: [
    { label: 'Clientes', to: '/clientes' },
  ],
  version: 1,
};

export const administracaoHelp: HelpEntry = {
  route: '/administracao',
  title: 'Administração',
  summary: 'Configurações da empresa, usuários, permissões, certificado digital, branding e parâmetros fiscais.',
  sections: [
    {
      heading: 'Acesso restrito',
      body: 'Toda esta área é acessível apenas para usuários com perfil Admin. Alterações afetam todos os usuários e são registradas em auditoria.',
    },
    {
      heading: 'Empresa',
      body: 'Dados cadastrais (CNPJ, IE, regime tributário), endereço de remetente padrão para etiquetas, contatos públicos e branding (logo, cores).',
    },
    {
      heading: 'Usuários e permissões',
      body: 'Crie usuários e atribua permissões granulares por módulo (visualizar, editar, excluir, rentabilidade). Sessões podem ser revogadas individualmente.',
    },
    {
      heading: 'Fiscal',
      body: 'Upload do certificado A1 (.pfx) com senha em cofre seguro. Configuração de série, ambiente (homologação/produção) e CFOPs padrão.',
    },
    {
      heading: 'E-mail',
      body: 'Configuração SMTP, templates transacionais e teste de envio. Fila assíncrona garante que falhas não travem o sistema.',
    },
  ],
  related: [
    { label: 'Auditoria', to: '/auditoria' },
    { label: 'Configurações', to: '/configuracoes' },
  ],
  version: 1,
};

export const auditoriaHelp: HelpEntry = {
  route: '/auditoria',
  title: 'Auditoria',
  summary: 'Histórico imutável de operações sensíveis: criações, edições, exclusões e mudanças de status com diff campo-a-campo.',
  sections: [
    {
      heading: 'O que é registrado',
      body: 'Toda operação relevante: cadastros (clientes, produtos, fornecedores), documentos (orçamentos, pedidos, NFs), baixas financeiras, ajustes de estoque e mudanças de permissão.',
    },
    {
      heading: 'Filtros',
      body: 'Por usuário, módulo, tipo de ação, período e termo livre. Cada linha permite ver o diff (antes/depois) dos campos alterados.',
    },
    {
      heading: 'Imutabilidade',
      body: 'Os registros não podem ser editados nem excluídos — nem por administradores. Garantia para conformidade.',
    },
  ],
  version: 1,
};

export const configuracoesHelp: HelpEntry = {
  route: '/configuracoes',
  title: 'Configurações',
  summary: 'Preferências pessoais: perfil, segurança, aparência, ajuda e dados básicos da empresa (admin).',
  sections: [
    {
      heading: 'Abas',
      body: 'Meu perfil (nome, foto, e-mail), Segurança (senha, sessões), Aparência (tema, densidade, fonte, menu, ajuda) e Empresa (apenas admins).',
    },
    {
      heading: 'Onde fica o quê',
      body: 'Configurações que afetam apenas você ficam aqui. Configurações que afetam toda a empresa (usuários, fiscal, branding) ficam em Administração.',
    },
    {
      heading: 'Tours guiados',
      body: 'Em Aparência, você controla se a sugestão de tour aparece em telas novas e pode reiniciar todos os tours já vistos.',
    },
  ],
  related: [
    { label: 'Administração', to: '/administracao' },
    { label: 'Central de ajuda', to: '/ajuda' },
  ],
  version: 1,
};