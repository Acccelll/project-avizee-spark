import { Hash } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SummaryCard } from '@/components/SummaryCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface RelatorioKpiCard {
  title: string;
  value: string;
  icon: LucideIcon;
  variation?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface Props {
  cards: RelatorioKpiCard[];
  compactDensity: boolean;
  hasLocalFiltersApplied: boolean;
  rowsCount: number;
  visibleCount: number;
  isLikelyTruncated: boolean;
}

/**
 * Grid 2×2 (mobile) → 4 colunas (xl) de KPIs do relatório, com banners de
 * aviso de truncamento (limite default Supabase) e divergência entre KPIs
 * (universo total) e tabela (filtros locais).
 */
export function RelatorioKpiGrid({
  cards,
  compactDensity,
  hasLocalFiltersApplied,
  rowsCount,
  visibleCount,
  isLikelyTruncated,
}: Props) {
  return (
    <>
      {hasLocalFiltersApplied && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
          <span className="font-medium">Atenção:</span>
          <span className="text-muted-foreground">
            Os KPIs abaixo refletem o universo total ({rowsCount} registros) retornado do banco.
            A tabela aplica filtros locais e mostra {visibleCount} de {rowsCount} registros.
          </span>
        </div>
      )}
      {isLikelyTruncated && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
          <span className="font-medium text-destructive">Resultado pode estar truncado:</span>
          <span className="text-muted-foreground">
            O relatório atingiu exatamente {rowsCount} registros (limite default da consulta). Refine o período ou os filtros para garantir que todos os dados sejam considerados.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((kpi) => (
          <div key={kpi.title} className="relative">
            <SummaryCard
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon ?? Hash}
              variationType="neutral"
              variation={hasLocalFiltersApplied ? `${kpi.variation || ''} (universo total)`.trim() : kpi.variation}
              variant={kpi.variant}
              density={compactDensity ? 'compact' : 'default'}
            />
            {hasLocalFiltersApplied && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-label="KPI reflete universo total; tabela aplica filtros locais"
                    className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 text-warning-foreground text-[11px] font-bold border border-warning/40 cursor-help"
                  >
                    !
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  KPI reflete o universo total ({rowsCount} registros).
                  A tabela exibe {visibleCount} registros após filtros locais.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ))}
      </div>
    </>
  );
}