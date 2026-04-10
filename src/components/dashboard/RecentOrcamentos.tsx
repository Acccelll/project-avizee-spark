import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

export function RecentOrcamentos({ items, loading }: { items: any[]; loading: boolean }) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  return (
    <div className="lg:col-span-2 bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Últimos Orçamentos</h3>
        <button onClick={() => navigate('/orcamentos')} className="text-xs text-primary hover:underline">Ver todos →</button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum orçamento encontrado</p>
      ) : (
        <div className="space-y-2">
          {items.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-muted/20 px-2 rounded cursor-pointer" onClick={() => pushView("orcamento", o.id)}>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium mono">{o.numero}</p>
                  <p className="text-xs text-muted-foreground">{o.clientes?.nome_razao_social || '—'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold mono">{formatCurrency(Number(o.valor_total || 0))}</p>
                <p className="text-xs text-muted-foreground">{formatDate(o.data_orcamento)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
