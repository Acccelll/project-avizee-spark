import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * DrawerActionBar — wrapper opinionado para a linha de ações do drawer.
 *
 * Hierarquia visual:
 *  - PRIMARY     → botão com label, destaque (default ou outline)
 *  - SECONDARY[] → ícones ghost com tooltip (Editar, Duplicar, Mais)
 *  - DESTRUCTIVE → ícone vermelho/destructive, sempre por último
 *
 * Sem padronizar estilos forçados além disso — o objetivo é evitar
 * que cada drawer reinvente o agrupamento.
 *
 * Uso:
 * ```tsx
 * <DrawerActionBar
 *   primary={canConfirmar ? { label: "Confirmar", icon: Check, onClick, pending } : undefined}
 *   secondary={[
 *     { icon: Edit, tooltip: "Editar", onClick: handleEdit, pending: editPending },
 *   ]}
 *   destructive={{ icon: Trash2, tooltip: "Excluir", onClick: handleDelete }}
 * />
 * ```
 */

export interface DrawerActionPrimary {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  /** "default" (filled) ou "outline". Default: default. */
  variant?: "default" | "outline";
  ariaLabel?: string;
}

export interface DrawerActionSecondary {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  /** Coloração opcional (ex: warning para Estornar). */
  tone?: "default" | "warning" | "success" | "primary";
}

export interface DrawerActionDestructive {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}

export interface DrawerActionBarProps {
  primary?: DrawerActionPrimary;
  secondary?: DrawerActionSecondary[];
  destructive?: DrawerActionDestructive;
  /** Conteúdo extra à esquerda (raro — só se precisar de algo customizado). */
  leading?: ReactNode;
  className?: string;
}

const secondaryToneClass: Record<NonNullable<DrawerActionSecondary["tone"]>, string> = {
  default: "",
  warning: "text-warning hover:text-warning",
  success: "text-success hover:text-success",
  primary: "text-primary hover:text-primary",
};

export function DrawerActionBar({
  primary,
  secondary,
  destructive,
  leading,
  className,
}: DrawerActionBarProps) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {leading}

      {secondary?.map((s, i) => {
        const Icon = s.icon;
        return (
          <Tooltip key={`${s.tooltip}-${i}`}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", secondaryToneClass[s.tone ?? "default"])}
                aria-label={s.tooltip}
                disabled={s.pending || s.disabled}
                onClick={s.onClick}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{s.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}

      {destructive && (() => {
        const Icon = destructive.icon;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label={destructive.tooltip}
                disabled={destructive.pending || destructive.disabled}
                onClick={destructive.onClick}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{destructive.tooltip}</TooltipContent>
          </Tooltip>
        );
      })()}

      {primary && (() => {
        const Icon = primary.icon;
        return (
          <Button
            size="sm"
            variant={primary.variant ?? "default"}
            className="gap-1.5 ml-1"
            disabled={primary.pending || primary.disabled}
            aria-label={primary.ariaLabel ?? primary.label}
            onClick={primary.onClick}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {primary.label}
          </Button>
        );
      })()}
    </div>
  );
}
