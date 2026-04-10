import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, FileText, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';
import { Skeleton } from '@/components/ui/skeleton';

interface ComercialBlockProps {
  cotacoesAbertas: number;
  pedidosPendentes: number;
  ticketMedio: number;
  recentOrcamentos: any[];
  loading?: boolean;
}

const statusStyles: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  pendente: 'bg-warning/15 text-warning',
  aprovado: 'bg-success/15 text-success',
  reprovado: 'bg-destructive/15 text-destructive',
  cancelado: 'bg-muted text-muted-foreground',
};

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
};

export function ComercialBlock({
  cotacoesAbertas,
  pedidosPendentes,
  ticketMedio,
  recentOrcamentos,
  loading,
}: ComercialBlockProps) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  return (
    <div className="bg-card rounded-xl border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-secondary" />
          Comercial
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate('/orcamentos')}
        >
          Ver módulo <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 border-b border-border/60">
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Cotações abertas</p>
          <p className="text-lg font-bold mono mt-0.5">{formatNumber(cotacoesAbertas)}</p>
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          <p className="text-xs text-muted-foreground">Pedidos pendentes</p>
          <p className="text-lg font-bold mono mt-0.5">{formatNumber(pedidosPendentes)}</p>
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="text-lg font-bold mono mt-0.5">{formatCurrency(ticketMedio)}</p>
        </div>
      </div>

      {/* Últimos orçamentos */}
      <div className="flex-1 px-5 pt-3 pb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Últimos Orçamentos
        </p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        ) : recentOrcamentos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum orçamento no período</p>
        ) : (
          <div className="space-y-1">
            {recentOrcamentos.map((o: any) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded py-1.5 px-1 hover:bg-muted/20 cursor-pointer"
                onClick={() => pushView('orcamento', o.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium mono leading-tight">{o.numero}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{o.clientes?.nome_razao_social || '—'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right ml-3">
                  <p className="text-xs font-semibold mono">{formatCurrency(Number(o.valor_total || 0))}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusStyles[o.status] || 'bg-muted text-muted-foreground'}`}>
                      {statusLabel[o.status] || o.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 px-5 py-2">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => navigate('/pedidos')}
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Ver pedidos →
        </Button>
      </div>
    </div>
  );
}
