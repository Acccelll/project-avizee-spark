import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * RecordIdentityCard — faixa padronizada de identidade do registro.
 *
 * Usado dentro de `DrawerHeaderShell.recordSummary` / `usePublishDrawerSlots({ summary })`.
 * Substitui o bloco copiado em 8 Views: avatar circular + título + meta + badges.
 *
 * Uso:
 * ```tsx
 * <RecordIdentityCard
 *   icon={Receipt}
 *   title={selected.numero}
 *   titleMono
 *   meta={`${formatDate(data)} · ${cliente}`}
 *   badges={<><StatusBadge status={selected.status} /></>}
 * />
 * ```
 */
export interface RecordIdentityCardProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Quando true, aplica `font-mono` ao título (códigos, SKUs, números). */
  titleMono?: boolean;
  /** Linha de subtítulo (data, cliente, código). */
  subtitle?: ReactNode;
  /** Linha auxiliar (ex: meta breve em uma linha extra). */
  meta?: ReactNode;
  /** Conteúdo de badges/chips (StatusBadge, valor, contexto). */
  badges?: ReactNode;
  className?: string;
}

export function RecordIdentityCard({
  icon: Icon,
  title,
  titleMono = false,
  subtitle,
  meta,
  badges,
  className,
}: RecordIdentityCardProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={cn("font-semibold text-sm leading-tight truncate", titleMono && "font-mono")}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        )}
        {meta && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            {meta}
          </div>
        )}
        {badges && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {badges}
          </div>
        )}
      </div>
    </div>
  );
}
