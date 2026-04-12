import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobileCardField<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  primary?: boolean;
}

interface MobileCardListProps<T extends { id?: string }> {
  items: T[];
  fields: MobileCardField<T>[];
  onItemClick?: (item: T) => void;
  actions?: (item: T) => ReactNode;
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
  className,
  emptyMessage = "Nenhum item encontrado.",
}: MobileCardListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  const primaryField = fields.find((f) => f.primary) ?? fields[0];
  const detailFields = fields.filter((f) => !f.primary);

  const renderValue = (item: T, field: MobileCardField<T>): ReactNode => {
    if (field.render) return field.render(item);
    const val = (item as Record<string, unknown>)[field.key];
    return val != null ? String(val) : "—";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, idx) => (
        <div
          key={item.id ?? idx}
          className={cn(
            "relative rounded-xl border bg-card px-4 py-3 transition-colors active:bg-muted/50",
            onItemClick && "cursor-pointer",
          )}
          onClick={() => onItemClick?.(item)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Primary field */}
              {primaryField && (
                <div className="font-medium text-sm leading-snug">
                  {renderValue(item, primaryField)}
                </div>
              )}
              {/* Detail fields */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {detailFields.map((field) => (
                  <div key={field.key} className="flex items-baseline gap-1 min-w-0">
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {field.label}:
                    </span>
                    <span className="text-xs">{renderValue(item, field)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Actions slot */}
            {actions && (
              <div
                className="flex shrink-0 items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(item)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
