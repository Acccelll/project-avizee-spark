import { Button } from '@/components/ui/button';
import { Calendar, CalendarRange, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Period } from './periodTypes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const periods: { value: Period; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '15d', label: '15 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'year', label: 'Este ano' },
];

/**
 * PeriodFilter — fonte única de filtros temporais (ver `mem://produto/contrato-de-periodos`).
 *
 * Modos:
 *  - "preset"  → apenas chips de preset (ex.: Hoje, 7d, 30d…). API legada.
 *  - "range"   → apenas date pickers (de/até). Usado em Auditoria.
 *  - "both"    → chips + popover "Personalizar período". Padrão das telas
 *                operacionais (Estoque, Pedidos, Financeiro).
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
}

function isLegacy(value: Period | PeriodValue): value is Period {
  return typeof value === 'string';
}

export function PeriodFilter({ value, onChange, options, mode = 'preset' }: PeriodFilterProps) {
  const items = options || periods;
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
      {showPresets &&
        items.map((p) => {
          const isActive = !hasCustomRange && v.preset === p.value;
          return (
            <Button
              key={p.value}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => emit({ preset: p.value, from: null, to: null })}
              className={cn('h-8 text-xs', !isActive && 'text-muted-foreground')}
            >
              {p.label}
            </Button>
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
