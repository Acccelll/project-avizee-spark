import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileDashboardHeaderProps {
  lastUpdated?: Date;
  onRefresh?: () => void;
  rightSlot?: React.ReactNode;
  fetching?: boolean;
}

/** Barra enxuta: atualizar e personalizar, sem filtro parcial do Dashboard. */
export function MobileDashboardHeader({ lastUpdated, onRefresh, rightSlot, fetching = false }: MobileDashboardHeaderProps) {
  const updated = lastUpdated?.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }) ?? '—';
  return (
    <div className="-mx-4 mb-3 sticky z-30 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ top: 'var(--app-header-height, 56px)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {fetching ? 'Atualizando…' : `Atualizado às ${updated}`}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={fetching}
              className="h-9 w-9 shrink-0"
              aria-label={fetching ? 'Atualizando…' : 'Atualizar Dashboard'}>
              <RefreshCw className={cn('h-4 w-4', fetching && 'animate-spin')} />
            </Button>
          )}
          {rightSlot}
        </div>
      </div>
    </div>
  );
}
