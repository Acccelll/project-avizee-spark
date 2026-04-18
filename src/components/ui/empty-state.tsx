import { LucideIcon, PackageOpen } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateVariant = "default" | "noResults" | "firstUse";

interface EmptyStateProps {
  /** Lucide icon to display; defaults to PackageOpen */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Arbitrary action node (e.g. a Button) rendered below the description */
  action?: ReactNode;
  /**
   * Semantic variant — controla a cor do círculo do ícone para
   * diferenciar visualmente o tipo de estado vazio.
   *
   * - `default`: bg-muted (sem dados/genérico)
   * - `noResults`: bg-info/10 (filtro sem resultados)
   * - `firstUse`: bg-primary/10 (primeira utilização, CTA destacada)
   */
  variant?: EmptyStateVariant;
  className?: string;
}

const variantStyles: Record<
  EmptyStateVariant,
  { wrapper: string; icon: string }
> = {
  default: {
    wrapper: "bg-muted",
    icon: "text-muted-foreground",
  },
  noResults: {
    wrapper: "bg-info/10",
    icon: "text-info",
  },
  firstUse: {
    wrapper: "bg-primary/10",
    icon: "text-primary",
  },
};

/**
 * Standardised empty-state placeholder for list/table views.
 *
 * @example
 * // Sem dados cadastrados
 * <EmptyState
 *   icon={ShoppingCart}
 *   title="Nenhum pedido encontrado"
 *   description="Crie seu primeiro pedido para começar."
 *   action={<Button onClick={handleNew}>Novo Pedido</Button>}
 * />
 *
 * @example
 * // Filtro sem resultados (use NoResultsState para versão pronta)
 * <EmptyState
 *   variant="noResults"
 *   icon={SearchX}
 *   title="Nenhum resultado encontrado"
 *   description="Tente ajustar os filtros aplicados."
 * />
 *
 * @example
 * // Primeira utilização — CTA destacada
 * <EmptyState
 *   variant="firstUse"
 *   icon={Sparkles}
 *   title="Configure sua primeira conta"
 *   description="Comece adicionando uma conta bancária."
 *   action={<Button onClick={handleStart}>Começar</Button>}
 * />
 */
export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const styles = variantStyles[variant];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      <div className={cn("rounded-full p-4 mb-4", styles.wrapper)}>
        <Icon className={cn("h-8 w-8", styles.icon)} />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
