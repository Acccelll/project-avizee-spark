import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, formatCurrency } from '@/lib/format';

interface FiscalStats {
  emitidas: number;
  pendentes: number;
  canceladas: number;
  valorEmitidas: number;
}

interface FiscalBlockProps {
  stats: FiscalStats;
}

export function FiscalBlock({ stats }: FiscalBlockProps) {
  const navigate = useNavigate();

  const items = [
    {
      label: 'Notas emitidas',
      value: formatNumber(stats.emitidas),
      sub: formatCurrency(stats.valorEmitidas),
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Pendentes de emissão',
      value: formatNumber(stats.pendentes),
      sub: stats.pendentes > 0 ? 'ação necessária' : 'sem pendências',
      icon: Clock,
      color: stats.pendentes > 0 ? 'text-warning' : 'text-muted-foreground',
      bg: stats.pendentes > 0 ? 'bg-warning/10' : 'bg-muted/40',
    },
    {
      label: 'Canceladas',
      value: formatNumber(stats.canceladas),
      sub: 'no período',
      icon: AlertCircle,
      color: stats.canceladas > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: stats.canceladas > 0 ? 'bg-destructive/10' : 'bg-muted/40',
    },
  ];

  return (
    <div className="bg-card rounded-xl border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-secondary" />
          Fiscal
          {stats.pendentes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
              <Clock className="h-2.5 w-2.5" />
              {stats.pendentes} pendente{stats.pendentes > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate('/fiscal')}
        >
          Ver módulo <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Status das notas */}
      <div className="flex-1 px-5 pt-4 pb-5 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5 hover:bg-muted/20 cursor-pointer"
              onClick={() => navigate('/fiscal')}
            >
              <div className={`rounded-lg p-2 ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.sub}</p>
              </div>
              <span className={`text-lg font-bold mono ${item.color}`}>{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
