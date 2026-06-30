import { useNavigate } from 'react-router-dom';
import { FileText, UserPlus, Package, ShoppingCart, Receipt, DollarSign } from 'lucide-react';
import { quickActions } from '@/lib/navigation';

const ICONS: Record<string, typeof FileText> = {
  'nova-cotacao': FileText,
  'novo-cliente': UserPlus,
  'novo-produto': Package,
  'novo-pedido-compra': ShoppingCart,
  'nova-nota-saida': Receipt,
  'baixa-financeira': DollarSign,
};

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-2xl border border-border/70 p-3.5 shadow-soft">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ações Rápidas
      </h3>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = ICONS[action.id] ?? FileText;
          return (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              aria-label={action.description}
              title={action.description}
              className="group relative flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-1.5 py-2 text-center hover-lift press-down focus-ring hover:border-primary/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-foreground line-clamp-2">
                {action.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
