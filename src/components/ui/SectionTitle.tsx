import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionTitle — cabeçalho padronizado para seções dentro de Views/Drawers.
 *
 * Substitui as 4 variações de `<h4 className="font-semibold ... text-muted-foreground uppercase text-[10px]">`
 * espalhadas pelas Views.
 *
 * Uso:
 * ```tsx
 * <SectionTitle icon={CreditCard}>Situação Financeira</SectionTitle>
 * <SectionTitle icon={CreditCard} action={<Button size="sm">Adicionar</Button>}>Lançamentos</SectionTitle>
 * ```
 */
export interface SectionTitleProps {
  children: ReactNode;
  icon?: LucideIcon;
  /** Slot opcional à direita (botão, badge etc.). */
  action?: ReactNode;
  /** Quando true, adiciona uma borda inferior sutil (estilo "section divider"). */
  bordered?: boolean;
  className?: string;
}

export function SectionTitle({
  children,
  icon: Icon,
  action,
  bordered = false,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-1",
        bordered && "border-b pb-1.5 mb-1",
        className,
      )}
    >
      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {children}
      </h4>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
