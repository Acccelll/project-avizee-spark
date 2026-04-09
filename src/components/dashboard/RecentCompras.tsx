import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

export function RecentCompras({ items, loading }: { items: any[]; loading: boolean }) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Últimas Compras</h3>
        <button onClick={() => navigate('/pedidos-compra')} className="text-xs text-primary hover:underline">Ver todas →</button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma compra encontrada</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c: any, idx: number) => (
            <div key={idx} className="border rounded-lg p-3 hover:bg-muted/20 cursor-pointer" onClick={() => pushView("pedido_compra", c.id)}>
              <div className="flex justify-between items-center mb-1">
                <span className="mono text-xs font-medium text-primary">{c.numero}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.data_compra)}</span>
              </div>
              <p className="text-sm truncate">{c.fornecedores?.nome_razao_social || '—'}</p>
              <p className="mono font-semibold text-sm mt-1">{formatCurrency(Number(c.valor_total || 0))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
