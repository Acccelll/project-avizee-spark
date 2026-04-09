import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  Truck,
  Package,
  FileText,
  Users,
  Receipt,
} from 'lucide-react';

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
  estoqueBaixo: number;
  remessasAtrasadas: number;
  comprasAguardando: number;
  notasPendentes: number;
  ovsPendentes: number;
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
  estoqueBaixo,
  remessasAtrasadas,
  comprasAguardando,
  notasPendentes,
  ovsPendentes,
}: AlertStripProps) {
  const navigate = useNavigate();

  const items: AlertItem[] = [
    {
      id: 'vencidos',
      label: 'Títulos vencidos',
      count: titulosVencidos,
      icon: Receipt,
      severity: 'error',
      href: '/financeiro?status=vencido',
    },
    {
      id: 'estoque',
      label: 'Estoque mínimo',
      count: estoqueBaixo,
      icon: Package,
      severity: 'error',
      href: '/estoque',
    },
    {
      id: 'remessas',
      label: 'Remessas atrasadas',
      count: remessasAtrasadas,
      icon: Truck,
      severity: 'warning',
      href: '/remessas',
    },
    {
      id: 'compras',
      label: 'Compras pendentes',
      count: comprasAguardando,
      icon: ClipboardList,
      severity: 'warning',
      href: '/pedidos-compra',
    },
    {
      id: 'notas',
      label: 'Notas pendentes',
      count: notasPendentes,
      icon: FileText,
      severity: 'info',
      href: '/fiscal',
    },
    {
      id: 'ovs',
      label: 'Pedidos a faturar',
      count: ovsPendentes,
      icon: Users,
      severity: 'info',
      href: '/pedidos',
    },
  ].filter((item) => item.count > 0);

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
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas
        </span>
        {items.map((item) => {
          const styles = severityStyles[item.severity];
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${styles.badge}`}
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
