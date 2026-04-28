import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currentMonthKey, formatMonthKey } from '@/lib/periodFilter';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface MonthFilterProps {
  /** Mês selecionado no formato `YYYY-MM`, ou null/undefined quando vazio. */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Direção temporal — apenas para o tooltip do botão. */
  direction?: 'past' | 'future' | 'neutral';
  className?: string;
}

/**
 * MonthFilter — seleciona um mês fechado (1º → último dia).
 * Complementa o PeriodFilter; quando ativo, a tela deve ignorar o
 * preset/range do PeriodFilter (uma única fonte de verdade temporal).
 * Ver `mem://produto/contrato-de-periodos`.
 */
export function MonthFilter({ value, onChange, direction = 'neutral', className }: MonthFilterProps) {
  const todayKey = currentMonthKey();
  const initialYear = value ? Number(value.slice(0, 4)) : Number(todayKey.slice(0, 4));
  const [year, setYear] = useState(initialYear);
  const [open, setOpen] = useState(false);

  const selectedYear = value ? Number(value.slice(0, 4)) : null;
  const selectedMonth = value ? Number(value.slice(5, 7)) : null;

  const tooltipBase =
    direction === 'future' ? 'Vencimentos do mês' :
    direction === 'past' ? 'Movimentos do mês' :
    'Selecionar mês';

  const apply = (m: number) => {
    onChange(`${year}-${String(m).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'default' : 'outline'}
          size="sm"
          className={cn('h-8 text-xs gap-1.5', !value && 'text-muted-foreground', className)}
          title={tooltipBase}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {value ? formatMonthKey(value) : 'Mês'}
          {value && (
            <X
              className="h-3 w-3 ml-1 opacity-70 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              aria-label="Limpar mês"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const isSelected = selectedYear === year && selectedMonth === m;
            const isCurrent = todayKey === `${year}-${String(m).padStart(2, '0')}`;
            return (
              <Button
                key={name}
                size="sm"
                variant={isSelected ? 'default' : isCurrent ? 'secondary' : 'ghost'}
                className={cn('h-8 text-xs', !isSelected && !isCurrent && 'text-muted-foreground')}
                onClick={() => apply(m)}
              >
                {name}
              </Button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setYear(Number(todayKey.slice(0, 4)));
              onChange(todayKey);
              setOpen(false);
            }}
          >
            Mês atual
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { onChange(null); setOpen(false); }}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}