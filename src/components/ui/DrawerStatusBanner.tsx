import { ReactNode } from "react";
import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DrawerStatusBanner — banner contextual padronizado para drawers.
 *
 * Substitui blocos hand-rolled (rounded-lg border bg-warning/5 ...) usados
 * em diversos drawers para alertas de status (overdue, em atraso, ajuste manual,
 * confirmação pendente etc.). Usa tokens semânticos do design system.
 *
 * Uso:
 * ```tsx
 * <DrawerStatusBanner
 *   tone="warning"
 *   icon={AlertCircle}
 *   title="Pedido em atraso"
 *   description="Entrega prevista em 12/04 — 5 dias de atraso."
 * />
 * ```
 */
export type DrawerStatusTone =
  | "neutral"
  | "info"
  | "primary"
  | "success"
  | "warning"
  | "destructive";

const toneSurface: Record<DrawerStatusTone, string> = {
  neutral:     "bg-muted/40 border-border",
  info:        "bg-primary/5 border-primary/20",
  primary:     "bg-primary/5 border-primary/20",
  success:     "bg-success/5 border-success/20",
  warning:     "bg-warning/5 border-warning/30",
  destructive: "bg-destructive/5 border-destructive/30",
};

const toneIcon: Record<DrawerStatusTone, string> = {
  neutral:     "text-muted-foreground",
  info:        "text-primary",
  primary:     "text-primary",
  success:     "text-success",
  warning:     "text-warning",
  destructive: "text-destructive",
};

const toneTitle: Record<DrawerStatusTone, string> = {
  neutral:     "text-foreground",
  info:        "text-primary",
  primary:     "text-primary",
  success:     "text-success",
  warning:     "text-warning",
  destructive: "text-destructive",
};

export interface DrawerStatusBannerProps {
  tone?: DrawerStatusTone;
  /** Ícone Lucide. Default: Info. */
  icon?: LucideIcon;
  /** Título curto e direto. */
  title: ReactNode;
  /** Descrição opcional (1-2 linhas). */
  description?: ReactNode;
  /** Slot opcional à direita (ex: botão "Ver detalhes"). */
  action?: ReactNode;
  className?: string;
}

export function DrawerStatusBanner({
  tone = "info",
  icon: Icon = Info,
  title,
  description,
  action,
  className,
}: DrawerStatusBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border p-3 flex items-start gap-2.5",
        toneSurface[tone],
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", toneIcon[tone])} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={cn("text-sm font-semibold leading-tight", toneTitle[tone])}>
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
