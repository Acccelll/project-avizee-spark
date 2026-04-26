import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, Pause, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AsyncJobStatus — visualizador unificado de jobs assíncronos.
 *
 * Substitui badges + barras de progresso ad-hoc espalhados em
 * `ImportacaoTimeline`, `ApresentacaoHistoricoTable`, fila de e-mail e
 * `WorkbookGeracoesTable`. Garante o mesmo vocabulário visual em todo o ERP.
 *
 * Estados (alinhados com `apresentacao_geracoes.status` e `pgmq`):
 *   - queued     → aguardando processamento
 *   - running    → em execução (mostra progresso)
 *   - succeeded  → concluído com sucesso
 *   - failed     → erro terminal (mostra mensagem)
 *   - cancelled  → cancelado pelo usuário/sistema
 *   - paused     → suspenso (backoff, espera de aprovação)
 *
 * Use `compact` para tabelas densas; `progress` (0–100) só aparece em `running`.
 */

export type AsyncJobState =
  | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'paused';

interface StateMeta {
  label: string;
  icon: LucideIcon;
  className: string;
  spin?: boolean;
}

const STATE: Record<AsyncJobState, StateMeta> = {
  queued:    { label: 'Na fila',     icon: Clock,         className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  running:   { label: 'Processando', icon: Loader2,       className: 'bg-info/10 text-info border-info/30', spin: true },
  succeeded: { label: 'Concluído',   icon: CheckCircle2,  className: 'bg-success/10 text-success border-success/30' },
  failed:    { label: 'Falhou',      icon: XCircle,       className: 'bg-destructive/10 text-destructive border-destructive/30' },
  cancelled: { label: 'Cancelado',   icon: AlertTriangle, className: 'bg-warning/10 text-warning border-warning/30' },
  paused:    { label: 'Pausado',     icon: Pause,         className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
};

export interface AsyncJobStatusProps {
  state: AsyncJobState;
  /** 0–100; só renderizado em `running`. */
  progress?: number;
  /** Mensagem de erro mostrada em `failed`/`cancelled`. */
  message?: string | null;
  /** Modo compacto (apenas ícone + label curto) para tabelas. */
  compact?: boolean;
  className?: string;
}

export function AsyncJobStatus({
  state, progress, message, compact = false, className,
}: AsyncJobStatusProps) {
  const meta = STATE[state];
  const Icon = meta.icon;
  const ariaLabel = message ? `${meta.label}: ${message}` : meta.label;

  return (
    <div className={cn('inline-flex flex-col gap-1', className)} aria-label={ariaLabel}>
      <Badge
        variant="outline"
        className={cn('inline-flex items-center gap-1.5 font-medium', meta.className)}
      >
        <Icon className={cn('h-3 w-3', meta.spin && 'animate-spin')} aria-hidden="true" />
        <span className={cn(compact && 'sr-only')}>{meta.label}</span>
        {compact && <span className="text-[10px]">{meta.label}</span>}
      </Badge>
      {state === 'running' && typeof progress === 'number' && !compact && (
        <Progress value={Math.max(0, Math.min(100, progress))} className="h-1" />
      )}
      {(state === 'failed' || state === 'cancelled') && message && !compact && (
        <p className="text-xs text-muted-foreground line-clamp-2" role="alert">{message}</p>
      )}
    </div>
  );
}
