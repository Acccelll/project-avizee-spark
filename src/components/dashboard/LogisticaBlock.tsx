import { useNavigate } from 'react-router-dom';
import { ArrowRight, Truck, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

interface LogisticaBlockProps {
  comprasAguardando: any[];
  totalRemessasAtrasadas: number;
}

function calcDiasEntrega(compra: any) {
  if (!compra.data_entrega_prevista) return null;
  const hoje = new Date();
  const prevista = new Date(compra.data_entrega_prevista);
  return Math.ceil((prevista.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function LogisticaBlock({ comprasAguardando, totalRemessasAtrasadas }: LogisticaBlockProps) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  const atrasadas = comprasAguardando.filter((c) => {
    const dias = calcDiasEntrega(c);
    return dias !== null && dias < 0;
  }).length;

  return (
    <div className="bg-card rounded-xl border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Truck className="h-4 w-4 text-info" />
          Logística
          {(atrasadas > 0 || totalRemessasAtrasadas > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" />
              {atrasadas + totalRemessasAtrasadas} atraso{atrasadas + totalRemessasAtrasadas > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate('/remessas')}
        >
          Ver módulo <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 border-b border-border/60">
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Aguardando entrega</p>
          <p className="text-lg font-bold mono mt-0.5">{comprasAguardando.length}</p>
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          <p className="text-xs text-muted-foreground">Entregas atrasadas</p>
          <p className={`text-lg font-bold mono mt-0.5 ${atrasadas > 0 ? 'text-destructive' : 'text-foreground'}`}>
            {atrasadas}
          </p>
        </div>
      </div>

      {/* Lista compras aguardando */}
      <div className="flex-1 px-5 pt-3 pb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compras Aguardando Entrega
        </p>
        {comprasAguardando.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma entrega pendente
          </p>
        ) : (
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {comprasAguardando.slice(0, 7).map((c: any) => {
              const dias = calcDiasEntrega(c);
              const atrasado = dias !== null && dias < 0;
              const urgente = dias !== null && dias >= 0 && dias <= 3;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded py-1.5 px-1 hover:bg-muted/20 cursor-pointer"
                  onClick={() => pushView('pedido_compra', c.id)}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium mono leading-tight">{c.numero}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.fornecedores?.nome_razao_social || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right ml-3">
                    <p className="text-xs font-semibold mono">{formatCurrency(Number(c.valor_total || 0))}</p>
                    {dias !== null ? (
                      <p className={`text-[11px] flex items-center justify-end gap-0.5 font-medium ${
                        atrasado ? 'text-destructive' : urgente ? 'text-warning' : 'text-muted-foreground'
                      }`}>
                        <Clock className="h-2.5 w-2.5" />
                        {atrasado
                          ? `${Math.abs(dias)}d atrasado`
                          : dias === 0
                          ? 'Hoje'
                          : `${dias}d`}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{formatDate(c.data_pedido || c.data_compra)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
