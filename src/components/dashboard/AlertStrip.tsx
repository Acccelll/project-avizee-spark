import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  FileText,
  Receipt,
} from 'lucide-react';
import { buildDrilldownUrl } from '@/lib/dashboard/drilldown';

interface AlertItem {
  id: string;
  label: string;
  count: number;
  icon: typeof AlertTriangle;
  severity: 'error' | 'warning' | 'info';
  href: string;
}

interface AlertStripProps {
  titulosVencidos: number;
  notasPendentes: number;
}

const severityStyles = {
  error: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: 'text-destructive',
    dot: 'bg-destructive',
  },
  warning: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    icon: 'text-warning',
    dot: 'bg-warning',
  },
  info: {
    badge: 'bg-info/10 text-info border-info/20',
    icon: 'text-info',
    dot: 'bg-info',
  },
};

export function AlertStrip({
  titulosVencidos,
  notasPendentes,
}: AlertStripProps) {
  const navigate = useNavigate();

  const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;
  const items = [
    {
      id: 'vencidos',
      label: 'Títulos vencidos',
      count: titulosVencidos,
      icon: Receipt,
      severity: 'error',
      href: buildDrilldownUrl({ kind: 'financeiro:vencidos' }),
    },
    {
      id: 'notas',
      label: 'Notas pendentes',
      count: notasPendentes,
      icon: FileText,
      severity: notasPendentes > 5 ? 'warning' : 'info',
      href: buildDrilldownUrl({ kind: 'fiscal:rascunho' }),
    },
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] - SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER]);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-2.5 text-sm text-success">
        <div className="h-2 w-2 rounded-full bg-success" />
        <span className="font-medium">Nenhum alerta operacional no momento.</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="flex items-center gap-2 md:flex-wrap overflow-x-auto md:overflow-visible -mx-1 px-1 snap-x snap-mandatory md:snap-none scrollbar-thin">
        <span className="mr-1 hidden md:inline text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          Alertas
        </span>
        {items.map((item) => {
          const styles = severityStyles[item.severity];
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              role="link"
              aria-label={`${item.label}: ${item.count}`}
              className={`inline-flex shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 active:opacity-70 min-h-[36px] ${styles.badge}`}
            >
              <Icon className={`h-3 w-3 ${styles.icon}`} />
              <span>{item.label}</span>
              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${styles.dot} text-white`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
