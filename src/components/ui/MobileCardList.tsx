import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobileCardField<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  primary?: boolean;
  /** Marca como identificador secundário (CNPJ, SKU, código). Renderizado em mono cinza abaixo do primary. */
  identifier?: boolean;
}

interface MobileCardListProps<T extends { id?: string }> {
  items: T[];
  fields: MobileCardField<T>[];
  onItemClick?: (item: T) => void;
  actions?: (item: T) => ReactNode;
  /** Ícones de ação rápida (até 3) renderizados no rodapé do card (📞 Wpp ✉ 👁). Cada um é um botão 36px touch-friendly. */
  actionsInline?: (item: T) => ReactNode;
  className?: string;
  emptyMessage?: string;
}

/**
 * Renders a list of items as touch-friendly cards for mobile.
 * Intended for use in modals, drawers, or any place where DataTable is not used.
 */
export function MobileCardList<T extends { id?: string }>({
  items,
  fields,
  onItemClick,
  actions,
  actionsInline,
  className,
  emptyMessage = "Nenhum item encontrado.",
}: MobileCardListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  const primaryField = fields.find((f) => f.primary) ?? fields[0];
  const identifierField = fields.find((f) => f.identifier);
  const detailFields = fields.filter((f) => !f.primary && !f.identifier);

  const renderValue = (item: T, field: MobileCardField<T>): ReactNode => {
    if (field.render) return field.render(item);
    const val = (item as Record<string, unknown>)[field.key];
    return val != null ? String(val) : "—";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {items.map((item, idx) => (
        <div
          key={item.id ?? idx}
          className={cn(
            "relative rounded-xl border bg-card px-3.5 py-2.5 transition-colors active:bg-muted/60",
            onItemClick && "cursor-pointer",
          )}
          onClick={() => onItemClick?.(item)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              {/* Primary: title forte */}
              {primaryField && (
                <div className="font-semibold text-[15px] leading-snug truncate">
                  {renderValue(item, primaryField)}
                </div>
              )}
              {/* Identifier (CNPJ/SKU/código): mono cinza */}
              {identifierField && (
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {renderValue(item, identifierField)}
                </div>
              )}
              {/* Detalhes secundários */}
              {detailFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-0.5">
                  {detailFields.map((field) => (
                    <div key={field.key} className="text-xs text-muted-foreground min-w-0 truncate">
                      {renderValue(item, field)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Menu ⋮ no canto */}
            {actions && (
              <div
                className="flex shrink-0 items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(item)}
              </div>
            )}
          </div>
          {/* Ações rápidas inline (📞 Wpp ✉ etc) — rodapé tap-friendly */}
          {actionsInline && (
            <div
              className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2"
              onClick={(e) => e.stopPropagation()}
            >
              {actionsInline(item)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
