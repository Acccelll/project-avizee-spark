import { useNavigate } from 'react-router-dom';
import {
  FileText,
  UserPlus,
  Package,
  ShoppingCart,
  Receipt,
  DollarSign,
} from 'lucide-react';

interface QuickAction {
  label: string;
  icon: typeof FileText;
  href: string;
  description: string;
}

const actions: QuickAction[] = [
  {
    label: 'Nova Cotação',
    icon: FileText,
    href: '/orcamentos/novo',
    description: 'Criar orçamento',
  },
  {
    label: 'Novo Cliente',
    icon: UserPlus,
    href: '/clientes',
    description: 'Cadastrar cliente',
  },
  {
    label: 'Novo Produto',
    icon: Package,
    href: '/produtos',
    description: 'Cadastrar produto',
  },
  {
    label: 'Novo Pedido',
    icon: ShoppingCart,
    href: '/pedidos-compra',
    description: 'Criar pedido de compra',
  },
  {
    label: 'Nova Nota',
    icon: Receipt,
    href: '/fiscal',
    description: 'Emitir nota fiscal',
  },
  {
    label: 'Baixa Financeira',
    icon: DollarSign,
    href: '/financeiro',
    description: 'Registrar pagamento',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border p-5 h-full">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Ações Rápidas</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className="flex flex-col items-start gap-1.5 rounded-lg border border-border/60 bg-background p-3 text-left transition-colors hover:bg-muted/40 hover:border-primary/30 active:scale-[0.98]"
            >
              <div className="rounded-md bg-primary/10 p-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium leading-tight text-foreground">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
