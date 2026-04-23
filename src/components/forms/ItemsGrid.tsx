import { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ItemsGridColumn<T> {
  key: string;
  label: string;
  /** Render the cell. Receives the item and its index. */
  render: (item: T, index: number) => ReactNode;
  /** Tailwind width class for desktop column (e.g. "w-32"). */
  width?: string;
  align?: "left" | "right" | "center";
  /** Optional override label for mobile card layout. Defaults to `label`. */
  mobileLabel?: string;
  /** Hide column on mobile cards (e.g. ações). */
  hideOnMobile?: boolean;
}

export interface ItemsGridProps<T> {
  columns: ItemsGridColumn<T>[];
  items: T[];
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  emptyMessage?: string;
  /** Footer area (totais, observações). */
  footerSummary?: ReactNode;
  /** Disable add/remove (read-only mode). */
  readOnly?: boolean;
  /** Stable key for React lists. Defaults to index. */
  rowKey?: (item: T, index: number) => string | number;
  className?: string;
}

/**
 * ItemsGrid — wrapper canônico para grids de itens em formulários
 * (Orçamento, Pedido, Remessa, NF, Compra…).
 *
 * **Padrão preferido para novos forms.** Renderiza tabela em desktop e
 * cards empilhados em mobile, com botão remover por linha e CTA "Adicionar".
 * Pricing/regras de negócio ficam no `render` de cada coluna — o componente
 * é puramente estrutural.
 *
 * Forms legados (OrcamentoForm/PedidoForm/RemessaForm) seguem com sua grid
 * própria; migração é on-demand para evitar regressões em regras específicas.
 * Ver `mem://produto/mobile-overview.md`.
 */
export function ItemsGrid<T>({
  columns,
  items,
  onRemove,
  onAdd,
  addLabel = "Adicionar item",
  emptyMessage = "Nenhum item adicionado.",
  footerSummary,
  readOnly = false,
  rowKey,
  className,
}: ItemsGridProps<T>) {
  const showActions = !readOnly && !!onRemove;
  const keyOf = (item: T, i: number) => (rowKey ? rowKey(item, i) : i);
  const alignClass = (a?: ItemsGridColumn<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Desktop table */}
      <div className="hidden md:block rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide",
                    alignClass(c.align),
                    c.width,
                  )}
                >
                  {c.label}
                </th>
              ))}
              {showActions && <th className="w-12 px-2" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr
                  key={keyOf(item, i)}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2 align-middle", alignClass(c.align))}>
                      {c.render(item, i)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-2 py-2 align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove?.(i)}
                        aria-label={`Remover item ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={keyOf(item, i)}
              className="rounded-md border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Item {i + 1}
                </span>
                {showActions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -mt-1 -mr-1 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove?.(i)}
                    aria-label={`Remover item ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <dl className="space-y-1.5">
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {c.mobileLabel ?? c.label}
                      </dt>
                      <dd className="text-sm text-right min-w-0 flex-1">
                        {c.render(item, i)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))
        )}
      </div>

      {footerSummary && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          {footerSummary}
        </div>
      )}

      {!readOnly && onAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="h-11 w-full md:h-9 md:w-auto gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}