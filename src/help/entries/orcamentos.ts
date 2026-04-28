import type { HelpEntry } from '../types';

export const orcamentosHelp: HelpEntry = {
  route: '/orcamentos',
  title: 'Orçamentos',
  summary: 'Crie, gerencie e converta orçamentos em pedidos. Inclui rentabilidade em tempo real, condições especiais por cliente e link público para aprovação.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'No topo: KPIs (total, valor, aprovados, taxa de conversão). Abaixo: filtros avançados, busca e a tabela. À direita do título, o botão "Novo Orçamento" abre o formulário em página cheia.',
    },
    {
      heading: 'Fluxo padrão',
      body: 'Rascunho → Enviado ao cliente → Aprovado → Convertido em pedido. Você pode cancelar com motivo a qualquer momento; rascunhos podem ser excluídos definitivamente. Cada transição grava auditoria.',
    },
    {
      heading: 'Criar um orçamento',
      body: 'O formulário é uma página dedicada (fluxos longos com itens dinâmicos não usam drawer). Abas: Geral (cliente, vendedor, validade, condições), Itens (produtos com preço, desconto, frete por linha) e Rentabilidade (margem por item e total — visível só para quem tem permissão).',
    },
    {
      heading: 'Itens, descontos e tributação',
      body: 'Adicione itens com preço de tabela ou condição especial (cliente > grupo > tabela base). Descontos aceitam % ou R$, por item ou no total. Impostos são calculados automaticamente conforme regime tributário, NCM e CFOP padrão da operação.',
    },
    {
      heading: 'Rentabilidade',
      body: 'A margem é calculada em tempo real a partir do custo médio do produto. Vendedores sem permissão de "rentabilidade" não veem custos nem margens. A regra `orcamentoInternalAccess` controla isso por usuário.',
    },
    {
      heading: 'Ações por linha',
      body: 'Visualizar (drawer com tudo), Editar, Enviar ao cliente (gera link público), Aprovar (manualmente), Converter em pedido, Duplicar, Cancelar (motivo obrigatório), Excluir (só rascunhos).',
    },
    {
      heading: 'Conversão em pedido',
      body: '"Converter em pedido" gera o pedido de venda mantendo vínculo bidirecional para auditoria. Alterações posteriores no pedido NÃO afetam o orçamento original. O pedido entra em "Aguardando faturamento".',
    },
    {
      heading: 'Compartilhamento público',
      body: 'O botão "Enviar" gera um link público (sem login) para o cliente visualizar e aprovar. Configure expiração e branding em Administração → Empresa.',
    },
    {
      heading: 'Excluir × Inativar × Cancelar',
      body: 'Excluir: só rascunhos sem histórico. Cancelar: orçamentos enviados/aprovados — exige motivo e mantém para auditoria. Não há "inativar" para orçamentos.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + N', desc: 'Novo orçamento' },
    { keys: 'Ctrl/Cmd + 2', desc: 'Ir para Orçamentos' },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Clientes', to: '/clientes' },
    { label: 'Produtos', to: '/produtos' },
  ],
  tour: [
    {
      target: 'orcamentos.filtros',
      title: 'Filtros e busca',
      body: 'Filtre por status, cliente, vendedor e período. As preferências de filtro ficam salvas por usuário. A busca cobre número e cliente.',
    },
    {
      target: 'orcamentos.tabela',
      title: 'Lista de orçamentos',
      body: 'Cada linha mostra status com cor padronizada. Clique para abrir o drawer de visualização com itens, histórico e ações.',
    },
    {
      target: '',
      title: 'Ações por linha',
      body: 'Passe o mouse na linha (ou abra o menu de ações em mobile) para Enviar, Aprovar, Converter em pedido, Duplicar ou Cancelar — sem precisar abrir o drawer.',
    },
    {
      target: 'orcamentos.novoBtn',
      title: 'Criar um novo orçamento',
      body: 'Abre o formulário em página cheia (não drawer) por causa dos itens dinâmicos. Você verá abas: Geral, Itens e Rentabilidade.',
    },
    {
      target: '',
      title: 'Aba Itens',
      body: 'Adicione produtos buscando por código, nome ou EAN. Aplique desconto por linha ou no total. Os impostos são calculados automaticamente.',
    },
    {
      target: '',
      title: 'Conversão em pedido',
      body: 'Quando o cliente aprovar, use "Converter em pedido" no drawer ou nas ações da linha. O orçamento fica vinculado ao pedido para auditoria.',
    },
  ],
  version: 3,
};
