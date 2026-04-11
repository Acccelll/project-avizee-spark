import { LucideIcon, PackageOpen } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon to display; defaults to PackageOpen */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Arbitrary action node (e.g. a Button) rendered below the description */
  action?: ReactNode;
  className?: string;
}

/**
 * Standardised empty-state placeholder for list/table views.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={ShoppingCart}
 *   title="Nenhum pedido encontrado"
 *   description="Tente ajustar os filtros ou crie um novo pedido."
 *   action={<Button onClick={handleNew}>Novo Pedido</Button>}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
