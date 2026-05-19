import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * CollapsibleSection — wrapper que renderiza um cabeçalho desktop normal
 * e, no mobile, vira um acordeão tappable com `min-h-[44px]` de touch target.
 *
 * Compartilhado entre GruposEconomicos, Socios e qualquer modal/seção que
 * queira o mesmo padrão "expand/collapse no mobile, header inline no desktop".
 */
export interface CollapsibleSectionProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary?: ReactNode;
  rightSlot?: ReactNode;
  desktopHeader: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  icon: Icon,
  title,
  summary,
  rightSlot,
  desktopHeader,
  children,
  className,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);

  if (!isMobile) {
    return (
      <div className={className}>
        {desktopHeader}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("border-t first:border-t-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-3 min-h-[44px] text-left active:bg-muted/40 transition-colors"
      >
        <Icon className="h-4 w-4 text-primary/70 shrink-0" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {rightSlot}
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {!open && summary && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[180px] text-right">
              {summary}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}