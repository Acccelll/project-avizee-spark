import {
  Plus,
  FileText,
  UserPlus,
  Package,
  ClipboardList,
  Receipt,
  Wallet,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import type { QuickAction } from '@/lib/navigation';

interface MobileQuickActionsGridProps {
  actions: QuickAction[];
  onAction: (path: string) => void;
  onEdit: () => void;
}

/** Rótulo curto exibido no card (label da referência). */
const SHORT_LABEL: Record<string, string> = {
  'nova-cotacao': 'Orçamento',
  'novo-cliente': 'Cliente',
  'novo-produto': 'Produto',
  'novo-pedido-compra': 'Pedido',
  'nova-nota-saida': 'NF-e',
  'baixa-financeira': 'Baixa',
};

const ICON_BY_ID: Record<string, LucideIcon> = {
  'nova-cotacao': FileText,
  'novo-cliente': UserPlus,
  'novo-produto': Package,
  'novo-pedido-compra': ClipboardList,
  'nova-nota-saida': Receipt,
  'baixa-financeira': Wallet,
};

export function MobileQuickActionsGrid({ actions, onAction, onEdit }: MobileQuickActionsGridProps) {
  return (
    <section aria-labelledby="mobile-menu-quick-actions" className="px-3 pt-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h3
          id="mobile-menu-quick-actions"
          className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70"
        >
          Atalhos rápidos
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Personalizar atalhos rápidos"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      </div>
      {actions.length === 0 ? (
        <p className="rounded-lg bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
          Nenhum atalho disponível para o seu perfil.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {actions.map((action) => {
            const Icon = ICON_BY_ID[action.id] ?? Plus;
            const label = SHORT_LABEL[action.id] ?? action.title;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.path)}
                aria-label={`${action.title} — ${action.description}`}
                className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-1 text-foreground transition hover:bg-accent active:scale-[0.98]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="line-clamp-1 text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
