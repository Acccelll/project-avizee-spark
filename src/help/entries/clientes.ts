import type { HelpEntry } from '../types';

export const clientesHelp: HelpEntry = {
  route: '/clientes',
  title: 'Clientes',
  summary: 'Cadastro de clientes (PF/PJ) com endereços, contatos, condições comerciais, grupo econômico e relacionamento com transportadoras.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'KPIs (Total, Ativos, Inativos, Com Grupo). Filtros (status, tipo PF/PJ, grupo) e busca (nome, CNPJ, e-mail, cidade). Tabela com inline actions (telefone, WhatsApp, e-mail).',
    },
    {
      heading: 'Cadastro com enriquecimento',
      body: 'CNPJ é validado e enriquecido automaticamente via consulta pública (razão social, fantasia, endereço, IE). CEP usa ViaCEP para preencher logradouro/bairro/cidade/UF. Para PF, valida CPF.',
    },
    {
      heading: 'Drawer/Modal de edição',
      body: 'Abas: Geral (dados cadastrais), Endereços (cobrança, entrega — múltiplos), Contatos (pessoas, e-mails, telefones), Comercial (condições, vendedor padrão), Comunicações (histórico de e-mails enviados).',
    },
    {
      heading: 'Condições comerciais',
      body: 'Forma de pagamento padrão, prazo, tabela de preço e desconto máximo. Vendedores não podem aplicar descontos acima do máximo configurado — o ERP bloqueia.',
    },
    {
      heading: 'Endereços e contatos',
      body: 'Aceita múltiplos endereços (cobrança, entrega) e múltiplos contatos. O endereço de entrega padrão é usado nos pedidos; o de cobrança vai para o boleto e NF-e.',
    },
    {
      heading: 'Grupo econômico',
      body: 'Associe clientes ao mesmo grupo para condições comerciais herdadas e relatórios consolidados. Configurações específicas do cliente sobrescrevem as do grupo.',
    },
    {
      heading: 'Inativar × Excluir',
      body: 'Inativar: cliente some de novas listas mas mantém histórico (recomendado). Excluir: só permitido para clientes sem nenhum movimento. A tabela usa soft delete (marca inativo).',
    },
    {
      heading: 'Ações inline',
      body: 'Diretamente da linha: ligar, abrir WhatsApp, enviar e-mail, abrir drawer. Em mobile, ficam destacadas como botões grandes.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + C', desc: 'Ir para Clientes' },
  ],
  related: [
    { label: 'Grupos econômicos', to: '/grupos-economicos' },
    { label: 'Orçamentos', to: '/orcamentos' },
    { label: 'Pedidos', to: '/pedidos' },
  ],
  tour: [
    {
      target: 'clientes.filtros',
      title: 'Filtros e busca',
      body: 'Filtre por status, tipo (PF/PJ) e grupo econômico. Busque por nome, CNPJ, e-mail ou cidade.',
    },
    {
      target: 'clientes.tabela',
      title: 'Lista de clientes',
      body: 'Clique em uma linha para abrir o drawer com abas. Use os botões inline para ligar, mandar WhatsApp ou e-mail sem abrir o drawer.',
    },
    {
      target: 'clientes.novoBtn',
      title: 'Novo cliente',
      body: 'Abre o cadastro. Para PJ, digite só o CNPJ que o sistema preenche razão social, endereço e IE automaticamente. CEP usa ViaCEP.',
    },
    {
      target: '',
      title: 'Aba Comercial',
      body: 'Defina forma de pagamento padrão, tabela de preço, vendedor responsável e desconto máximo. Vendedores não podem ultrapassar esse desconto nos pedidos.',
    },
    {
      target: '',
      title: 'Múltiplos endereços e contatos',
      body: 'Cadastre endereço de cobrança (vai para boleto/NF-e) e de entrega (vai para remessa). Múltiplos contatos com função (financeiro, comercial, etc.).',
    },
    {
      target: '',
      title: 'Inativar em vez de excluir',
      body: 'Para clientes com histórico, prefira Inativar. Excluir só funciona se o cliente nunca teve movimento e exige confirmação.',
    },
  ],
  version: 3,
};
