import { RefreshCw, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboardPeriod, type DashboardPeriod } from '@/contexts/DashboardPeriodContext';
import { useSafeDateInput } from '@/lib/safeDateInput';

interface DashboardHeaderProps {
  lastUpdated?: Date;
  onRefresh?: () => void;
  /** Optional slot rendered alongside the period selector / refresh button. */
  rightSlot?: React.ReactNode;
}

export function DashboardHeader({ lastUpdated, onRefresh, rightSlot }: DashboardHeaderProps) {
  const {
    period,
    setPeriod,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
  } = useDashboardPeriod();

  const startInput = useSafeDateInput(customStart, setCustomStart);
  const endInput = useSafeDateInput(customEnd, setCustomEnd);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span>{dateLabel}</span>
            <span className="hidden md:inline text-border">·</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Atualizado às {lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={period} onValueChange={(v: DashboardPeriod) => setPeriod(v)}>
              <SelectTrigger className="h-8 w-[175px] text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-8 gap-1.5" aria-label="Atualizar dados do dashboard">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          )}
          {rightSlot}
        </div>
      </div>

      {period === 'custom' && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={startInput.value}
              onChange={startInput.onChange}
              onBlur={startInput.onBlur}
              aria-invalid={startInput.invalid || undefined}
              className={`mt-1 h-8 text-sm ${startInput.invalid ? 'border-destructive' : ''}`}
            />
          </div>
          <div>
            <Label className="text-xs">Data final</Label>
            <Input
              type="date"
              value={endInput.value}
              onChange={endInput.onChange}
              onBlur={endInput.onBlur}
              aria-invalid={endInput.invalid || undefined}
              className={`mt-1 h-8 text-sm ${endInput.invalid ? 'border-destructive' : ''}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
