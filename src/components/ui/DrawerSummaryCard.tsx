import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DrawerSummaryCard — KPI card padronizado para a faixa de resumo dos drawers.
 *
 * Substitui as variações ad-hoc usadas em cada módulo (bg-accent/30, bg-card+text-center,
 * bg-muted/30 etc.) por um componente único com 4 tons semânticos.
 *
 * Uso:
 * ```tsx
 * <DrawerSummaryCard label="Saldo Atual" value={formatCurrency(saldo)} tone={saldo>=0?"success":"destructive"} />
 * ```
 */
export type DrawerSummaryTone = "neutral" | "primary" | "success" | "warning" | "destructive";

export interface DrawerSummaryCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Linha auxiliar pequena abaixo do valor (unidade, contexto). */
  hint?: ReactNode;
  /** Slot opcional para badge/ícone à direita do label. */
  trailing?: ReactNode;
  tone?: DrawerSummaryTone;
  /** Quando true, força fonte mono no valor. Default: true. */
  mono?: boolean;
  /** Alinhamento do conteúdo. Default: left. */
  align?: "left" | "center";
  className?: string;
}

const toneSurface: Record<DrawerSummaryTone, string> = {
  neutral:     "bg-muted/30 border-border",
  primary:     "bg-primary/5 border-primary/20",
  success:     "bg-success/5 border-success/20",
  warning:     "bg-warning/5 border-warning/20",
  destructive: "bg-destructive/5 border-destructive/20",
};

const toneText: Record<DrawerSummaryTone, string> = {
  neutral:     "text-foreground",
  primary:     "text-primary",
  success:     "text-success",
  warning:     "text-warning",
  destructive: "text-destructive",
};

export function DrawerSummaryCard({
  label,
  value,
  hint,
  trailing,
  tone = "neutral",
  mono = true,
  align = "left",
  className,
}: DrawerSummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-0.5 min-w-0",
        toneSurface[tone],
        align === "center" && "text-center",
        className,
      )}
    >
      <div className={cn("flex items-center gap-1.5", align === "center" && "justify-center")}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
        {trailing}
      </div>
      <p
        className={cn(
          "text-sm font-bold leading-tight truncate",
          mono && "font-mono",
          toneText[tone],
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
      )}
    </div>
  );
}

/**
 * DrawerSummaryGrid — wrapper grid responsivo padrão (2 col mobile, 4 col sm+).
 */
export function DrawerSummaryGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const colsClass =
    cols === 2 ? "grid-cols-2"
    : cols === 3 ? "grid-cols-2 sm:grid-cols-3"
    : "grid-cols-2 sm:grid-cols-4";
  return <div className={cn("grid gap-2", colsClass, className)}>{children}</div>;
}
