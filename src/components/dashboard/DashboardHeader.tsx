import { CalendarRange, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboardPeriod, type DashboardPeriod } from '@/contexts/DashboardPeriodContext';

interface DashboardHeaderProps {
  companyName?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
}

export function DashboardHeader({ companyName, lastUpdated, onRefresh }: DashboardHeaderProps) {
  const {
    period,
    setPeriod,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
  } = useDashboardPeriod();

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
            {companyName && (
              <>
                <span className="font-medium text-foreground/70">{companyName}</span>
                <span className="hidden md:inline text-border">·</span>
              </>
            )}
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
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-8 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          )}
        </div>
      </div>

      {period === 'custom' && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Data final</Label>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setPeriod('custom')}
            >
              Aplicar período
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
