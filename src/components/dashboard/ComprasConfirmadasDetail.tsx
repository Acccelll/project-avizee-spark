import { useNavigate } from 'react-router-dom';
import { Truck, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

function calcDiasEntrega(compra: any) {
  if (!compra.data_entrega_prevista) return null;
  const hoje = new Date();
  const prevista = new Date(compra.data_entrega_prevista);
  return Math.ceil((prevista.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function ComprasConfirmadasDetail({ items }: { items: any[] }) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();
  if (items.length === 0) return null;

  const atrasadas = items.filter((c) => {
    const dias = calcDiasEntrega(c);
    return dias !== null && dias < 0;
  }).length;

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Truck className="w-4 h-4 text-info" />
          Compras Confirmadas
          {atrasadas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <button onClick={() => navigate('/pedidos-compra')} className="text-xs text-primary hover:underline">Ver todas →</button>
      </div>
      <div className="space-y-2 max-h-[260px] overflow-y-auto">
        {items.map((c: any) => {
          const diasEntrega = calcDiasEntrega(c);
          return (
            <div
              key={c.id}
              className="flex items-center justify-between py-2 px-2 border-b last:border-b-0 hover:bg-muted/20 rounded cursor-pointer"
              onClick={() => pushView("pedido_compra", c.id)}
            >
              <div>
                <p className="text-sm font-medium mono">{c.numero}</p>
                <p className="text-xs text-muted-foreground">{c.fornecedores?.nome_razao_social || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold mono">{formatCurrency(Number(c.valor_total || 0))}</p>
                {diasEntrega !== null ? (
                  <p className={`text-xs font-medium flex items-center justify-end gap-1 ${
                    diasEntrega < 0 ? 'text-destructive' : diasEntrega <= 3 ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {diasEntrega < 0
                      ? `${Math.abs(diasEntrega)}d atrasado`
                      : diasEntrega === 0
                      ? 'Entrega hoje'
                      : `${diasEntrega}d p/ entrega`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{formatDate(c.data_pedido || c.data_compra)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
