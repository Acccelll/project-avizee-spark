import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * HealthBadge — indicador padronizado de saúde de integrações externas.
 *
 * Use para sinalizar status operacional de serviços como Sefaz, SMTP, Correios,
 * AI Gateway, etc., em painéis administrativos e cards de configuração.
 *
 * Estados:
 *   - healthy   → verde   (success)  — funcionando normalmente
 *   - degraded  → amarelo (warning)  — operando com lentidão / falhas parciais
 *   - down      → vermelho (destructive) — fora do ar / erro persistente
 *   - unknown   → cinza   (muted)    — sem leitura recente
 *   - checking  → azul    (info)     — verificação em andamento
 *
 * Diferente de `StatusBadge` (status de domínio do ERP), este componente é
 * exclusivo para **saúde operacional de integrações** e suporta tooltip com
 * detalhes (latência, último erro, timestamp da última verificação).
 */

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'checking';

interface HealthMeta {
  icon: LucideIcon;
  label: string;
  classes: string;
  iconClasses?: string;
}

const healthMeta: Record<HealthStatus, HealthMeta> = {
  healthy: {
    icon: CheckCircle2,
    label: 'Operacional',
    classes: 'bg-success/10 text-success border-success/20',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degradado',
    classes: 'bg-warning/10 text-warning border-warning/20',
  },
  down: {
    icon: XCircle,
    label: 'Fora do ar',
    classes: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Sem leitura',
    classes: 'bg-muted text-muted-foreground border-border',
  },
  checking: {
    icon: Loader2,
    label: 'Verificando…',
    classes: 'bg-info/10 text-info border-info/20',
    iconClasses: 'animate-spin',
  },
};

interface HealthBadgeProps {
  status: HealthStatus;
  /** Substitui o label padrão (ex.: "Operacional", "Degradado"). */
  label?: string;
  /**
   * Detalhes opcionais exibidos no tooltip (latência média, último erro,
   * timestamp da última checagem). Quando ausente, o tooltip não é renderizado.
   */
  details?: string;
  /** Renderiza apenas o ponto colorido + ícone, sem texto. Útil em tabelas densas. */
  compact?: boolean;
  className?: string;
}

export function HealthBadge({
  status,
  label,
  details,
  compact = false,
  className,
}: HealthBadgeProps) {
  const meta = healthMeta[status] ?? healthMeta.unknown;
  const Icon = meta.icon;
  const displayLabel = label ?? meta.label;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium gap-1',
        meta.classes,
        compact && 'px-1.5',
        className,
      )}
      aria-label={`Status de integração: ${displayLabel}${details ? `. ${details}` : ''}`}
    >
      <Icon className={cn('h-3 w-3', meta.iconClasses)} aria-hidden="true" />
      {!compact && <span>{displayLabel}</span>}
    </Badge>
  );

  if (!details) return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-medium">{displayLabel}</p>
          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">{details}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}