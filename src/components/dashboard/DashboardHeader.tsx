import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  lastUpdated?: Date;
  onRefresh?: () => void;
  fetching?: boolean;
  rightSlot?: React.ReactNode;
}

/**
 * Os indicadores têm janelas próprias (snapshot, vencimento e histórico).
 * Não exibir um filtro global que só afeta parte deles.
 */
export function DashboardHeader({ lastUpdated, onRefresh, fetching = false, rightSlot }: DashboardHeaderProps) {
  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const updated = lastUpdated?.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }) ?? '—';

  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {dateLabel} · {fetching ? 'Atualizando…' : `Atualizado às ${updated}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={fetching}
            className="h-9 gap-1.5" aria-label="Atualizar dados do Dashboard">
            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        )}
        {rightSlot}
      </div>
    </div>
  );
}
