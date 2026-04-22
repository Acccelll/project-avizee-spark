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
    <div className="bg-card rounded-xl border p-4 h-full">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Ações Rápidas</h3>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => {
          const Icon = ICONS[action.id] ?? FileText;
          return (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              aria-label={action.description}
              className="flex flex-col items-start gap-1.5 rounded-lg border border-border/60 bg-background p-2.5 text-left transition-colors hover:bg-muted/40 hover:border-primary/30 active:scale-[0.98]"
            >
              <div className="rounded-md bg-primary/10 p-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium leading-tight text-foreground">{action.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
