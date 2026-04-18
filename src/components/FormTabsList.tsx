import { type ComponentType } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
 */
export function FormTabsList({ tabs, className, sticky = false }: FormTabsListProps) {
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
