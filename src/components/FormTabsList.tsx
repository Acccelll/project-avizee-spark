import { type ComponentType } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown } from "lucide-react";

export interface FormTabItem {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Contador opcional ao lado do label (ex: nº de endereços). */
  count?: number;
  disabled?: boolean;
}

interface FormTabsListProps {
  tabs: FormTabItem[];
  className?: string;
  /** Sticky abaixo do header do modal. */
  sticky?: boolean;
}

/**
 * Wrapper padronizado para abas dentro de modais de edição.
 * Use dentro de <Tabs value=... onValueChange=...>.
 * Em mobile, renderiza como uma pilha vertical (estilo accordion headers) — cada
 * aba ocupa linha inteira, touch target ≥44px, label completo visível, badge de
 * contagem alinhado à direita. Mantém a semântica nativa do Radix Tabs (TabsTrigger),
 * apenas troca o layout horizontal por vertical full-width.
 */
export function FormTabsList({ tabs, className, sticky = false }: FormTabsListProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <TabsList
        className={cn(
          "h-auto w-full flex-col gap-1 bg-transparent p-0",
          sticky && "sticky top-0 z-10 bg-background",
          className,
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className={cn(
                "group h-11 w-full justify-start gap-2 rounded-lg border bg-card px-3 text-sm font-medium",
                "data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:text-foreground",
                "data-[state=inactive]:text-muted-foreground",
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="flex-1 text-left truncate">{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold">
                  {tab.count}
                </Badge>
              )}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=active]:rotate-180"
                aria-hidden="true"
              />
            </TabsTrigger>
          );
        })}
      </TabsList>
    );
  }

  return (
    <TabsList
      className={cn(
        "h-auto w-full justify-start gap-1 bg-muted/50 p-1 flex-wrap",
        sticky && "sticky top-0 z-10",
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="h-8 gap-1.5 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] font-medium"
              >
                {tab.count}
              </Badge>
            )}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
