import { ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  /** Ícone Lucide opcional ao lado do título. */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  /** Texto auxiliar abaixo do título. */
  description?: ReactNode;
  /** Ações no canto direito do header (botões, links). */
  actions?: ReactNode;
  /** Remove a borda superior — útil para a primeira seção do formulário. */
  noBorder?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Cabeçalho de seção padronizado para todos os modais de edição.
 * Visual: ícone primary/70 + título uppercase + linha sutil + descrição opcional.
 */
export function FormSection({
  icon: Icon,
  title,
  description,
  actions,
  noBorder = false,
  className,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <section className={cn("space-y-3", !noBorder && "pt-5 border-t border-border/60 first:border-t-0 first:pt-0", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {Icon && <Icon className="h-3.5 w-3.5 text-primary/70" />}
            <span>{title}</span>
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground/80 leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </header>
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
