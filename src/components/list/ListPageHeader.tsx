import { ReactNode } from "react";
import { LucideIcon, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface HeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface ListPageHeaderProps {
  title: string;
  /** Short subtitle/description shown below the title. */
  subtitle?: string;
  /**
   * Operational context line shown above the title — use bullet-separated
   * scannable summary like "142 pedidos · 12 atrasados · R$ 45.300".
   */
  contextLine?: ReactNode;
  primaryAction?: HeaderAction & { icon?: LucideIcon };
  secondaryActions?: HeaderAction[];
  /** Fully custom slot replacing primaryAction/secondaryActions on the right. */
  rightSlot?: ReactNode;
  className?: string;
}

/**
 * Standardised header for listing/grid pages. Provides a consistent layout for
 * title, scannable context line, and primary + overflow actions.
 *
 * Use on operational/analytical screens (Pedidos, Fiscal, Financeiro, ...).
 * For simple cadastros, the lighter `ModulePage` header is fine.
 */
export function ListPageHeader({
  title,
  subtitle,
  contextLine,
  primaryAction,
  secondaryActions = [],
  rightSlot,
  className,
}: ListPageHeaderProps) {
  const PrimaryIcon = primaryAction?.icon ?? Plus;
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {contextLine && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {contextLine}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        {!rightSlot && primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="h-11 gap-2 sm:h-9 w-full sm:w-auto"
          >
            <PrimaryIcon className="h-4 w-4" />
            {primaryAction.label}
          </Button>
        )}
        {!rightSlot && secondaryActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                aria-label="Mais ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {secondaryActions.map((action, idx) => {
                const Icon = action.icon;
                const isDestructiveBoundary =
                  action.destructive &&
                  idx > 0 &&
                  !secondaryActions[idx - 1].destructive;
                return (
                  <div key={action.label}>
                    {isDestructiveBoundary && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={cn(
                        action.destructive &&
                          "text-destructive focus:text-destructive",
                      )}
                    >
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
