import { Button } from '@/components/ui/button';
import { Calendar, CalendarRange, CalendarClock, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Period } from './periodTypes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const periodsPast: { value: Period; label: string; tooltip: string }[] = [
  { value: 'hoje', label: 'Hoje', tooltip: 'Apenas hoje' },
  { value: '7d', label: 'Últ. 7d', tooltip: 'Últimos 7 dias' },
  { value: '15d', label: 'Últ. 15d', tooltip: 'Últimos 15 dias' },
  { value: '30d', label: 'Últ. 30d', tooltip: 'Últimos 30 dias' },
  { value: '90d', label: 'Últ. 90d', tooltip: 'Últimos 90 dias' },
  { value: 'year', label: 'Este ano', tooltip: '01/jan até hoje' },
];

const periodsFuture: { value: Period; label: string; tooltip: string }[] = [
  { value: 'hoje', label: 'Vence hoje', tooltip: 'Vencimentos de hoje' },
  { value: '7d', label: 'Próx. 7d', tooltip: 'Vencem nos próximos 7 dias' },
  { value: '15d', label: 'Próx. 15d', tooltip: 'Vencem nos próximos 15 dias' },
  { value: '30d', label: 'Próx. 30d', tooltip: 'Vencem nos próximos 30 dias' },
  { value: '90d', label: 'Próx. 90d', tooltip: 'Vencem nos próximos 90 dias' },
  { value: 'year', label: 'Até fim do ano', tooltip: 'Hoje até 31/dez' },
];

const periodsNeutral: { value: Period; label: string; tooltip: string }[] = [
  { value: 'hoje', label: 'Hoje', tooltip: 'Hoje' },
  { value: '7d', label: '7 dias', tooltip: '7 dias' },
  { value: '15d', label: '15 dias', tooltip: '15 dias' },
  { value: '30d', label: '30 dias', tooltip: '30 dias' },
  { value: '90d', label: '90 dias', tooltip: '90 dias' },
  { value: 'year', label: 'Este ano', tooltip: 'Este ano' },
];

export type PeriodDirection = 'past' | 'future' | 'neutral';

/**
 * PeriodFilter — fonte única de filtros temporais (ver `mem://produto/contrato-de-periodos`).
 *
 * Modos:
 *  - "preset"  → apenas chips de preset (ex.: Hoje, 7d, 30d…). API legada.
 *  - "range"   → apenas date pickers (de/até). Usado em Auditoria.
 *  - "both"    → chips + popover "Personalizar período". Padrão das telas
 *                operacionais (Estoque, Pedidos, Financeiro).
 *
 * Direção (clareza temporal):
 *  - "past"    → "Últ. 7d / 30d…", ícone histórico. Usado em emissão/movimento.
 *  - "future"  → "Próx. 7d / 30d…", ícone calendário+relógio. Usado em vencimentos.
 *  - "neutral" → labels genéricos.
 *
 * API legada (preserve back-compat): { value: Period; onChange: (Period) => void }.
 * API nova: { value: { preset?, from?, to? }; onChange: (next) => void; mode? }.
 */
export interface PeriodValue {
  preset?: Period | null;
  from?: string | null;
  to?: string | null;
}

interface PeriodFilterProps {
  value: Period | PeriodValue;
  onChange: ((period: Period) => void) | ((next: PeriodValue) => void);
  options?: { value: Period; label: string }[];
  mode?: 'preset' | 'range' | 'both';
  /**
   * Direção temporal — ajusta rótulos dos chips e ícone para indicar se o
   * filtro olha para trás (histórico) ou para frente (vencimentos).
   * Default: 'past' (preserva comportamento legado).
   */
  direction?: PeriodDirection;
}

function isLegacy(value: Period | PeriodValue): value is Period {
  return typeof value === 'string';
}

export function PeriodFilter({ value, onChange, options, mode = 'preset', direction = 'past' }: PeriodFilterProps) {
  const defaults = direction === 'future' ? periodsFuture : direction === 'neutral' ? periodsNeutral : periodsPast;
  // Quando `options` é passado (uso legado, ex.: financialPeriods), respeita-o,
  // mas se direction='future', enriquece labels mapeando por `value`.
  const items = options
    ? options.map((o) => {
        const enriched = defaults.find((d) => d.value === o.value);
        return { value: o.value, label: enriched?.label ?? o.label, tooltip: enriched?.tooltip ?? o.label };
      })
    : defaults;
  const legacy = isLegacy(value);
  const v: PeriodValue = legacy ? { preset: value as Period } : value;

  const emit = (next: PeriodValue) => {
    if (legacy) {
      // Legacy callback expects Period; emit preset only.
      (onChange as (p: Period) => void)((next.preset ?? 'hoje') as Period);
      return;
    }
    (onChange as (n: PeriodValue) => void)(next);
  };

  const showPresets = mode === 'preset' || mode === 'both';
  const showRange = mode === 'range' || mode === 'both';
  const hasCustomRange = !!(v.from || v.to);

  const DirIcon = direction === 'future' ? CalendarClock : direction === 'past' ? History : Calendar;
  const dirLabel =
    direction === 'future' ? 'Período (vencimentos)' :
    direction === 'past' ? 'Período (histórico)' :
    'Período';

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={dirLabel}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-muted/50 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <DirIcon className="h-3.5 w-3.5" aria-hidden />
            {direction === 'future' ? 'Vencem' : direction === 'past' ? 'Período' : 'Período'}
          </span>
        </TooltipTrigger>
        <TooltipContent>{dirLabel}</TooltipContent>
      </Tooltip>
      {showPresets &&
        items.map((p) => {
          const isActive = !hasCustomRange && v.preset === p.value;
          const tip = (p as { tooltip?: string }).tooltip ?? p.label;
          return (
            <Tooltip key={p.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => emit({ preset: p.value, from: null, to: null })}
                  className={cn('h-8 text-xs', !isActive && 'text-muted-foreground')}
                >
                  {p.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tip}</TooltipContent>
            </Tooltip>
          );
        })}
      {showRange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={hasCustomRange ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 text-xs gap-1', !hasCustomRange && 'text-muted-foreground')}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {hasCustomRange ? `${v.from ?? '…'} → ${v.to ?? '…'}` : 'Personalizar'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={v.from ?? ''}
                  onChange={(e) => emit({ preset: null, from: e.target.value || null, to: v.to ?? null })}
                  className="h-9 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={v.to ?? ''}
                  onChange={(e) => emit({ preset: null, from: v.from ?? null, to: e.target.value || null })}
                  className="h-9 w-36 text-xs"
                />
              </div>
              {hasCustomRange && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={() => emit({ preset: null, from: null, to: null })}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
