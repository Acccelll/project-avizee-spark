import { Plus, Pencil } from 'lucide-react';
import type { QuickAction } from '@/lib/navigation';

interface MobileQuickActionsGridProps {
  actions: QuickAction[];
  onAction: (path: string) => void;
  onEdit: () => void;
}

export function MobileQuickActionsGrid({ actions, onAction, onEdit }: MobileQuickActionsGridProps) {
  return (
    <section aria-labelledby="mobile-menu-quick-actions" className="px-3 pt-3">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
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
        <div className="grid grid-cols-2 gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.path)}
              aria-label={`${action.title} — ${action.description}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2.5 text-left text-xs font-medium text-foreground transition hover:bg-accent active:scale-[0.98]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Plus className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 truncate">{action.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}