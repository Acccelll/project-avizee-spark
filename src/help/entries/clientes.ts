import type { HelpEntry } from '../types';

export const clientesHelp: HelpEntry = {
  route: '/clientes',
  title: 'Clientes',
  summary: 'Cadastro de clientes (PF/PJ) com endereços, contatos, condições comerciais e relacionamento com transportadoras.',
  sections: [
    {
      heading: 'Cadastro',
      body: 'CNPJ é validado e enriquecido automaticamente via consulta pública. CEP usa ViaCEP para preencher endereço. Para PF, valida CPF.',
    },
    {
      heading: 'Condições comerciais',
      body: 'Forma de pagamento padrão, prazo, tabela de preço e desconto máximo. Vendedores não podem aplicar descontos acima do máximo configurado.',
    },
    {
      heading: 'Endereços e contatos',
      body: 'Aceita múltiplos endereços (cobrança, entrega) e contatos. O endereço de entrega padrão é usado nos pedidos.',
    },
    {
      heading: 'Inativar × excluir',
      body: 'Inative clientes que não devem mais aparecer em novos pedidos mas precisam manter histórico. Excluir só é permitido para clientes sem nenhum movimento.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + C', desc: 'Ir para Clientes' },
  ],
  related: [
    { label: 'Grupos econômicos', to: '/grupos-economicos' },
    { label: 'Orçamentos', to: '/orcamentos' },
  ],
  tour: [
    {
      target: 'clientes.novoBtn',
      title: 'Novo cliente',
      body: 'Cadastre PF ou PJ. Informe o documento e os demais dados serão sugeridos automaticamente quando possível.',
    },
    {
      target: 'clientes.tabela',
      title: 'Lista de clientes',
      body: 'Clique em uma linha para abrir o drawer com tabs: Geral, Endereços, Contatos, Comercial, Histórico.',
    },
  ],
  version: 1,
};