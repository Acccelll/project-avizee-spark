export const mockNotifications = [
  { id: 'n1', level: 'success', title: 'Orçamento #ORC-2026-014 aprovado', description: 'Converter em pedido ou ordem de venda.', time: '5 min' },
  { id: 'n2', level: 'warning', title: '3 produtos abaixo do estoque mínimo', description: 'Priorize reposição para seringas e agulhas.', time: '18 min' },
  { id: 'n3', level: 'danger', title: 'Conta a pagar vence hoje', description: 'NF 5012 - Fornecedor Agroinsumos do Sul.', time: '34 min' },
  { id: 'n4', level: 'info', title: 'NF-e 352603... autorizada', description: 'Documento de saída vinculado à OV-021.', time: '2 h' },
];

export const mockRecentActivities = [
  'Orçamento ORC-2026-014 gerado para Granja Mantiqueira.',
  'Compra COMP-2026-031 recebida parcialmente.',
  'Nota fiscal NF-2026-118 confirmada com geração financeira.',
  'Conta a receber CR-2026-054 baixada no Inter.',
];

export const mockQuickActions = [
  { id: 'orcamento', title: 'Novo orçamento', path: '/orcamentos/novo' },
  { id: 'cliente', title: 'Novo cliente', path: '/clientes' },
  { id: 'produto', title: 'Novo produto', path: '/produtos' },
  { id: 'financeiro', title: 'Nova conta a pagar', path: '/financeiro?tipo=pagar' },
];

export const mockSearchEntities = [
  { id: 's1', title: 'Agulha Inox 10x10', subtitle: 'Produto · SKU AG-10X10', path: '/produtos', keywords: ['agulha', 'inox', 'produto'] },
  { id: 's2', title: 'Seringa Bouba 0,5 mL', subtitle: 'Produto composto', path: '/produtos', keywords: ['seringa', 'bouba', 'produto'] },
  { id: 's3', title: 'Granja Santa Helena', subtitle: 'Cliente · Grupo Econômico Mantiqueira', path: '/clientes', keywords: ['cliente', 'granja', 'santa helena'] },
  { id: 's4', title: 'BioVet Insumos', subtitle: 'Fornecedor estratégico', path: '/fornecedores', keywords: ['fornecedor', 'biovet'] },
  { id: 's5', title: 'ORC-2026-014', subtitle: 'Orçamento em negociação', path: '/orcamentos', keywords: ['orcamento', 'cotacao'] },
  { id: 's6', title: 'OV-2026-021', subtitle: 'Ordem de venda com faturamento parcial', path: '/ordens-venda', keywords: ['ov', 'ordem de venda'] },
  { id: 's7', title: 'NF-2026-118', subtitle: 'Nota fiscal de saída', path: '/fiscal?tipo=saida', keywords: ['nota fiscal', 'nfe'] },
  { id: 's8', title: 'Fluxo de Caixa Março/2026', subtitle: 'Relatório consolidado', path: '/relatorios?tipo=fluxo_caixa', keywords: ['fluxo de caixa', 'relatorio'] },
  { id: 's9', title: 'Inter - Conta Operacional', subtitle: 'Conta bancária', path: '/contas-bancarias', keywords: ['inter', 'banco'] },
];

export const mockPedidos = [
  { numero: 'PED-2026-001', cliente: 'Granja Santa Helena', origem: 'ORC-2026-014', valor: 'R$ 18.540,00', status: 'Aprovado', etapa: 'Aguardando OV' },
  { numero: 'PED-2026-002', cliente: 'Agropecuária Vale Verde', origem: 'ORC-2026-012', valor: 'R$ 9.880,00', status: 'Separação', etapa: 'Montando pedido' },
  { numero: 'PED-2026-003', cliente: 'Cooperativa Boa Postura', origem: 'ORC-2026-010', valor: 'R$ 27.300,00', status: 'Convertido', etapa: 'OV criada' },
];

export const mockMovimentacoes = [
  { data: '17/03/2026', produto: 'Agulha Inox 10x10', tipo: 'Saída', quantidade: 25, saldo: 120, documento: 'NF-2026-118' },
  { data: '16/03/2026', produto: 'Seringa Bouba 0,5 mL', tipo: 'Entrada', quantidade: 40, saldo: 86, documento: 'NF-2026-115' },
  { data: '15/03/2026', produto: 'Mola do Êmbolo 0,5', tipo: 'Ajuste', quantidade: -3, saldo: 18, documento: 'AJ-003' },
  { data: '14/03/2026', produto: 'Agulha Inox 15x15', tipo: 'Entrada', quantidade: 60, saldo: 210, documento: 'NF-2026-110' },
];
