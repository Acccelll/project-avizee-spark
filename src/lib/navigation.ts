import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  LucideIcon,
  Package,
  Receipt,
  Settings,
  Shield,
  Database,
  ShoppingCart,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
  FileSearch,
  UserCog,
  Share2,
} from 'lucide-react';

export interface NavLeafItem {
  title: string;
  path: string;
  keywords?: string[];
}

export interface NavSubgroup {
  title: string;
  items: NavLeafItem[];
}

export interface NavSection {
  key: string;
  title: string;
  icon: LucideIcon;
  /** When set, the section behaves as a direct link (no expand/collapse). */
  directPath?: string;
  /** Sub-groups with leaf items. Leave empty (or omit) for direct-path sections. */
  items: NavSubgroup[];
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  path: string;
  shortcut?: string;
}

export interface MobileBottomTab {
  key: string;
  title: string;
  icon: LucideIcon;
  path?: string;
}

export const dashboardItem: NavLeafItem = {
  title: 'Dashboard',
  path: '/',
  keywords: ['inicio', 'painel', 'visao geral'],
};

export const quickActions: QuickAction[] = [
  { id: 'nova-cotacao', title: 'Novo Orçamento', description: 'Criar proposta comercial', path: '/orcamentos/novo', shortcut: '⌘N' },
  { id: 'novo-cliente', title: 'Novo Cliente', description: 'Cadastrar cliente rapidamente', path: '/clientes' },
  { id: 'novo-produto', title: 'Novo Produto', description: 'Abrir cadastro de produto', path: '/produtos' },
  { id: 'abrir-financeiro', title: 'Contas a Receber', description: 'Ir para o financeiro filtrado', path: '/financeiro?tipo=receber' },
];

export const navSections: NavSection[] = [
  {
    key: 'cadastros',
    title: 'Cadastros',
    icon: Users,
    items: [
      {
        title: 'Base cadastral',
        items: [
          { title: 'Produtos', path: '/produtos', keywords: ['sku', 'catalogo'] },
          { title: 'Clientes', path: '/clientes' },
          { title: 'Fornecedores', path: '/fornecedores' },
          { title: 'Transportadoras', path: '/transportadoras', keywords: ['frete', 'logistica'] },
          { title: 'Formas de Pagamento', path: '/formas-pagamento', keywords: ['prazo', 'parcelamento'] },
          { title: 'Grupos Econômicos', path: '/grupos-economicos', keywords: ['matriz', 'filiais'] },
          { title: 'Funcionários', path: '/funcionarios', keywords: ['fopag', 'folha', 'salario', 'rh'] },
        ],
      },
    ],
  },
  {
    key: 'comercial',
    title: 'Comercial',
    icon: FileText,
    items: [
      {
        title: 'Pipeline de vendas',
        items: [
          { title: 'Orçamentos', path: '/orcamentos', keywords: ['orcamentos', 'propostas', 'cotacoes', 'cotações'] },
          { title: 'Pedidos', path: '/pedidos', keywords: ['pedidos', 'backlog', 'operacional', 'ordens', 'ov'] },
        ],
      },
    ],
  },
  {
    key: 'compras',
    title: 'Compras',
    icon: ShoppingCart,
    items: [
      {
        title: 'Gestão de compras',
        items: [
          { title: 'Cotações de Compra', path: '/cotacoes-compra', keywords: ['comparacao', 'fornecedores', 'cotacao'] },
          { title: 'Pedidos de Compra', path: '/pedidos-compra', keywords: ['pre-nota', 'pedido fornecedor', 'recebimento'] },
        ],
      },
    ],
  },
  {
    key: 'estoque',
    title: 'Suprimentos e Logística',
    icon: Warehouse,
    items: [
      {
        title: 'Controle',
        items: [
          { title: 'Posição Atual', path: '/estoque', keywords: ['saldo', 'inventario'] },
          { title: 'Logística', path: '/logistica', keywords: ['rastreio', 'entrega', 'logistica', 'correios'] },
        ],
      },
    ],
  },
  {
    key: 'financeiro',
    title: 'Financeiro',
    icon: DollarSign,
    items: [
      {
        title: 'Execução financeira',
        items: [
          { title: 'Contas a Pagar/Receber', path: '/financeiro', keywords: ['cp', 'cr', 'despesas', 'recebimentos'] },
          { title: 'Fluxo de Caixa', path: '/fluxo-caixa' },
          { title: 'Contas Bancárias', path: '/contas-bancarias', keywords: ['bancos'] },
          { title: 'Plano de Contas', path: '/contas-contabeis-plano', keywords: ['contabil'] },
          { title: 'Conciliação', path: '/conciliacao', keywords: ['ofx', 'extrato', 'banco', 'conciliar'] },
        ],
      },
    ],
  },
  {
    key: 'fiscal',
    title: 'Fiscal',
    icon: Receipt,
    items: [
      {
        title: 'Documentos fiscais',
        items: [
          { title: 'Notas de Entrada', path: '/fiscal?tipo=entrada', keywords: ['recebimento', 'fornecedor', 'compra', 'xml', 'chave', 'nfe'] },
          { title: 'Notas de Saída', path: '/fiscal?tipo=saida', keywords: ['faturamento', 'cliente', 'pedido', 'emissao', 'sefaz', 'nfe'] },
        ],
      },
    ],
  },

  {
    key: 'social',
    title: 'Social',
    icon: Share2,
    directPath: '/social',
    items: [],
  },

  {
    key: 'relatorios',
    title: 'Relatórios',
    icon: BarChart3,
    directPath: '/relatorios',
    items: [],
  },
  {
    key: 'administracao',
    title: 'Administração',
    icon: Shield,
    items: [
      {
        title: 'Gestão do sistema',
        items: [
          { title: 'Empresa', path: '/administracao?tab=empresa' },
          { title: 'Usuários e Permissões', path: '/administracao?tab=usuarios' },
          { title: 'E-mail', path: '/administracao?tab=email' },
          { title: 'Parâmetros Fiscais', path: '/administracao?tab=fiscal' },
          { title: 'Parâmetros Financeiros', path: '/administracao?tab=financeiro' },
          { title: 'Migração de Dados', path: '/migracao-dados', keywords: ['importacao', 'excel', 'csv', 'carga'] },
          { title: 'Auditoria', path: '/auditoria', keywords: ['logs', 'historico', 'rastreabilidade'] },
        ],
      },
    ],
  },
];

export const mobileBottomTabs: MobileBottomTab[] = [
  { key: 'inicio', title: 'Início', icon: LayoutDashboard, path: '/' },
  { key: 'comercial', title: 'Comercial', icon: FileText, path: '/orcamentos' },
  { key: 'cadastros', title: 'Cadastros', icon: Users, path: '/clientes' },
  { key: 'financeiro', title: 'Financeiro', icon: DollarSign, path: '/financeiro?tipo=receber' },
];

export const mobileMenuSections = navSections.filter((section) =>
  ['compras', 'estoque', 'fiscal', 'relatorios', 'administracao'].includes(section.key),
);

export const headerIcons: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/cotacoes': FileText,
  '/orcamentos': FileText,
  '/pedidos': ClipboardList,
  '/ordens-venda': ShoppingCart,
  '/compras': ShoppingCart,
  '/cotacoes-compra': ShoppingCart,
  '/pedidos-compra': ShoppingCart,
  '/produtos': Package,
  '/estoque': Warehouse,
  '/logistica': Truck,
  '/remessas': Truck,
  '/clientes': Users,
  '/fornecedores': Truck,
  '/transportadoras': Truck,
  '/formas-pagamento': CreditCard,
  '/grupos-economicos': Building2,
  '/funcionarios': UserCog,
  '/financeiro': Wallet,
  '/contas-bancarias': DollarSign,
  '/fluxo-caixa': DollarSign,
  '/caixa': DollarSign,
  '/contas-contabeis-plano': FileSearch,
  '/conciliacao': DollarSign,
  '/social': Share2,
  '/fiscal': Receipt,
  '/relatorios': BarChart3,
  '/configuracoes': Settings,
  '/administracao': Shield,
  '/migracao-dados': Database,
  '/auditoria': Shield,
  '/perfil': User,
};

const baseRouteLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/cotacoes': 'Cotações',
  '/orcamentos': 'Orçamentos',
  '/pedidos': 'Pedidos',
  '/ordens-venda': 'Pedidos',
  '/compras': 'Compras',
  '/cotacoes-compra': 'Cotações de Compra',
  '/pedidos-compra': 'Pedidos de Compra',
  '/produtos': 'Produtos',
  '/estoque': 'Estoque',
  '/logistica': 'Logística',
  '/remessas': 'Remessas (Legado)',
  '/clientes': 'Clientes',
  '/fornecedores': 'Fornecedores',
  '/transportadoras': 'Transportadoras',
  '/formas-pagamento': 'Formas de Pagamento',
  '/grupos-economicos': 'Grupos Econômicos',
  '/funcionarios': 'Funcionários',
  '/financeiro': 'Financeiro',
  '/contas-bancarias': 'Contas Bancárias',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/caixa': 'Caixa',
  '/contas-contabeis-plano': 'Plano de Contas',
  '/conciliacao': 'Conciliação',
  '/social': 'Social',
  '/fiscal': 'Fiscal',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
  '/administracao': 'Administração',
  '/migracao-dados': 'Migração de Dados',
  '/auditoria': 'Auditoria',
  '/perfil': 'Meu Perfil',
};

export type FlatNavItem = NavLeafItem & { section: string; subgroup: string };

export const flatNavItems: FlatNavItem[] = [
  { ...dashboardItem, section: '', subgroup: '' },
  ...navSections.flatMap((section) => {
    // Direct-path sections contribute a single synthetic leaf item
    if (section.directPath) {
      return [{ title: section.title, path: section.directPath, section: section.title, subgroup: '' }];
    }
    return section.items.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        section: section.title,
        subgroup: group.title,
      })),
    );
  }),
];

export function isPathActive(currentPath: string, targetPath: string) {
  const cleanTarget = targetPath.split('?')[0];
  if (cleanTarget === '/') return currentPath === '/';
  return currentPath === cleanTarget || currentPath.startsWith(`${cleanTarget}/`);
}

export function getRouteLabel(pathname: string) {
  if (baseRouteLabels[pathname]) return baseRouteLabels[pathname];
  const exactMatch = flatNavItems.find((item) => item.path === pathname);
  if (exactMatch) return exactMatch.title;
  const match = flatNavItems.find((item) => item.path.split('?')[0] === pathname);
  if (match) return match.title;
  if (pathname.startsWith('/orcamentos/')) return 'Orçamento';
  if (pathname.startsWith('/cotacoes/')) return 'Orçamento';
  if (pathname.startsWith('/clientes/')) return 'Cliente';
  if (pathname.startsWith('/produtos/')) return 'Produto';
  if (pathname.startsWith('/fiscal')) return 'Fiscal';
  return 'ERP AviZee';
}

export function getNavSectionKey(currentRoute: string) {
  if (currentRoute === '/' || currentRoute.startsWith('/?')) return 'inicio';
  const pathname = currentRoute.split('?')[0];
  // Check direct-path sections first
  const directSection = navSections.find(
    (entry) => entry.directPath && (pathname === entry.directPath || pathname.startsWith(`${entry.directPath}/`)),
  );
  if (directSection) return directSection.key;
  const section = navSections.find((entry) =>
    entry.items.some((group) =>
      group.items.some((item) => pathname === item.path.split('?')[0] || pathname.startsWith(`${item.path.split('?')[0]}/`)),
    ),
  );
  return section?.key ?? 'menu';
}
