import { LucideIcon, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** Hide this action conditionally. */
  hidden?: boolean;
}

interface RowActionsProps {
  /** Visible icon-button shown inline. Use for the most contextual action. */
  primary?: RowAction;
  /** Items inside the overflow menu. */
  secondary?: RowAction[];
  /** Destructive action — rendered last in the menu, separated, in red. */
  destructive?: RowAction;
  className?: string;
  /** Stop click propagation to avoid triggering row click. Default true. */
  stopPropagation?: boolean;
}

/**
 * Standardised inline row actions for grids/tables.
 * Pattern: one visible primary icon + overflow menu for the rest.
 * Keeps lines visually clean and prevents button walls in operational grids.
 */
export function RowActions({
  primary,
  secondary = [],
  destructive,
  className,
  stopPropagation = true,
}: RowActionsProps) {
  const visibleSecondary = secondary.filter((a) => !a.hidden);
  const hasMenu = visibleSecondary.length > 0 || (destructive && !destructive.hidden);

  const stop = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  return (
    <div
      className={cn("flex items-center justify-end gap-1", className)}
      onClick={stop}
    >
      {primary && !primary.hidden && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                stop(e);
                primary.onClick();
              }}
              disabled={primary.disabled}
              aria-label={primary.label}
            >
              {primary.icon && <primary.icon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{primary.label}</TooltipContent>
        </Tooltip>
      )}

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={stop}
              aria-label="Mais ações"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={stop}>
            {visibleSecondary.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              );
            })}
            {destructive && !destructive.hidden && (
              <>
                {visibleSecondary.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={destructive.onClick}
                  disabled={destructive.disabled}
                  className="text-destructive focus:text-destructive"
                >
                  {destructive.icon && (
                    <destructive.icon className="mr-2 h-4 w-4" />
                  )}
                  {destructive.label}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
