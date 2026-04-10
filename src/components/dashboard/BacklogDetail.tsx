import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock } from 'lucide-react';
import { formatCurrency, daysSince } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

const faturamentoLabel: Record<string, string> = {
  aguardando: 'Aguardando',
  parcial: 'Parcial',
  total: 'Total',
};

function calcDiasDespacho(ov: any) {
  if (ov.data_prometida_despacho) {
    const hoje = new Date();
    const prometida = new Date(ov.data_prometida_despacho);
    return Math.ceil((prometida.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  }
  return null;
}

export function BacklogDetail({ items }: { items: any[] }) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();
  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-warning" />
          OVs Aguardando Faturamento
        </h3>
        <button onClick={() => navigate('/pedidos')} className="text-xs text-primary hover:underline">Ver todas →</button>
      </div>
      <div className="space-y-2 max-h-[260px] overflow-y-auto">
        {items.map((ov: any) => {
          const diasDespacho = calcDiasDespacho(ov);
          return (
            <div
              key={ov.id}
              className="flex items-center justify-between py-2 px-2 border-b last:border-b-0 hover:bg-muted/20 rounded cursor-pointer"
              onClick={() => pushView("ordem_venda", ov.id)}
            >
              <div>
                <p className="text-sm font-medium mono">{ov.numero}</p>
                <p className="text-xs text-muted-foreground">{ov.clientes?.nome_razao_social || '—'}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  ov.status_faturamento === 'parcial' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'
                }`}>
                  {faturamentoLabel[ov.status_faturamento] || ov.status_faturamento}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold mono">{formatCurrency(Number(ov.valor_total || 0))}</p>
                {diasDespacho !== null ? (
                  <p className={`text-xs font-medium flex items-center justify-end gap-1 ${
                    diasDespacho < 0 ? 'text-destructive' : diasDespacho <= 3 ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {diasDespacho < 0 ? `${Math.abs(diasDespacho)}d atrasado` : `${diasDespacho}d p/ despacho`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{daysSince(ov.data_emissao)} dias</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
