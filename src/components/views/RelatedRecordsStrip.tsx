import { type ComponentType } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RelatedRecordChip {
  /** Ícone Lucide. */
  icon: LucideIcon | ComponentType<{ className?: string }>;
  /** Quantidade (ex.: 3). */
  count: number;
  /** Rótulo curto (ex.: "NFs", "Lançamentos"). */
  label: string;
  /** Tom visual. */
  tone?: "default" | "info" | "success" | "warning" | "primary";
  /** Callback ao clicar. Se omitido, chip aparece desabilitado. */
  onClick?: () => void;
  /** Tooltip / aria-label expandido (opcional). */
  title?: string;
}

interface RelatedRecordsStripProps {
  chips: RelatedRecordChip[];
  className?: string;
}

const toneClasses: Record<NonNullable<RelatedRecordChip["tone"]>, string> = {
  default: "border-border text-muted-foreground hover:bg-muted/40",
  info: "border-info/30 text-info hover:bg-info/10",
  success: "border-success/30 text-success hover:bg-success/10",
  warning: "border-warning/30 text-warning hover:bg-warning/10",
  primary: "border-primary/30 text-primary hover:bg-primary/10",
};

/**
 * Faixa horizontal de chips contadores no topo do Resumo de uma View,
 * mostrando vínculos cross-módulo (NFs, Lançamentos, Cotação origem, etc.).
 *
 * Resolve "vínculos enterrados" — o usuário vê de cara as conexões e pode
 * clicar para ir direto à tab/registro relacionado.
 */
export function RelatedRecordsStrip({ chips, className }: RelatedRecordsStripProps) {
  const visible = chips.filter((c) => c.count > 0);
  if (visible.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label="Registros relacionados"
    >
      {visible.map((chip, idx) => {
        const tone = chip.tone ?? "default";
        const Icon = chip.icon;
        const interactive = !!chip.onClick;
        return (
          <button
            key={idx}
            type="button"
            onClick={chip.onClick}
            disabled={!interactive}
            title={chip.title}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium transition-colors",
              toneClasses[tone],
              !interactive && "cursor-default opacity-80",
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="font-mono font-bold tabular-nums">{chip.count}</span>
            <span className="font-normal">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
