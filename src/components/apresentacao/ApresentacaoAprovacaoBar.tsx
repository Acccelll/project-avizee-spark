/**
 * ApresentacaoAprovacaoBar — V2
 *
 * Shows the current editorial status of a generation and provides
 * approve / reject actions. Only visible when a generation is selected.
 *
 * Status flow:
 *   rascunho → (auto-set to) revisao after generation
 *   revisao  → aprovado (via approve button)
 *   aprovado → rascunho (via reject/reopen button)
 *   gerado   = final state, read-only
 */
import { CheckCircle2, RotateCcw, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ApresentacaoStatusEditorial } from '@/types/apresentacao';

interface ApresentacaoAprovacaoBarProps {
  statusEditorial: ApresentacaoStatusEditorial;
  aprovadoPor?: string | null;
  aprovadoEm?: string | null;
  totalSlides?: number | null;
  canAprovar: boolean;
  isLoading?: boolean;
  onAprovar: () => void;
  onRejeitar: () => void;
}

const STATUS_CONFIG: Record<
  ApresentacaoStatusEditorial,
  {
    label: string;
    icon: React.ElementType;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
    color: string;
  }
> = {
  rascunho: {
    label: 'Rascunho',
    icon: Clock,
    badgeVariant: 'secondary',
    color: 'text-muted-foreground',
  },
  revisao: {
    label: 'Em Revisão',
    icon: AlertCircle,
    badgeVariant: 'outline',
    color: 'text-amber-600',
  },
  aprovado: {
    label: 'Aprovado',
    icon: CheckCircle2,
    badgeVariant: 'default',
    color: 'text-green-600',
  },
  gerado: {
    label: 'Gerado',
    icon: ShieldCheck,
    badgeVariant: 'default',
    color: 'text-blue-600',
  },
};

export function ApresentacaoAprovacaoBar({
  statusEditorial,
  aprovadoPor,
  aprovadoEm,
  totalSlides,
  canAprovar,
  isLoading = false,
  onAprovar,
  onRejeitar,
}: ApresentacaoAprovacaoBarProps) {
  const cfg = STATUS_CONFIG[statusEditorial] ?? STATUS_CONFIG.rascunho;
  const Icon = cfg.icon;

  const isReadOnly = statusEditorial === 'gerado';
  const isApproved = statusEditorial === 'aprovado';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
      {/* Left: status + metadata */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-1.5 ${cfg.color}`}>
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">Status Editorial:</span>
        </div>
        <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>

        {totalSlides != null && (
          <span className="text-xs text-muted-foreground">{totalSlides} slides</span>
        )}

        {isApproved && aprovadoPor && (
          <span className="text-xs text-muted-foreground">
            Aprovado em{' '}
            {aprovadoEm ? new Date(aprovadoEm).toLocaleString('pt-BR') : '—'}
          </span>
        )}
      </div>

      {/* Right: actions */}
      {!isReadOnly && canAprovar && (
        <div className="flex gap-2">
          {isApproved ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRejeitar}
              disabled={isLoading}
              aria-label="Reabrir para revisão"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reabrir
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onAprovar}
              disabled={isLoading || statusEditorial === 'rascunho'}
              aria-label="Aprovar apresentação"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Aprovar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
