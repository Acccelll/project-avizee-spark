import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';

export function EstoqueBaixoDetail({ items }: { items: any[] }) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();
  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Produtos Abaixo do Estoque Mínimo
        </h3>
      </div>
      <div className="space-y-2 max-h-[260px] overflow-y-auto">
        {items.slice(0, 10).map((p: any) => (
          <div
            key={p.id}
            className="flex items-center justify-between py-2 px-2 border-b last:border-b-0 hover:bg-muted/20 rounded cursor-pointer"
            onClick={() => pushView("produto", p.id)}
          >
            <div>
              <p className="text-sm font-medium">{p.nome}</p>
              <p className="text-xs text-muted-foreground mono">{p.codigo_interno || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm mono">
                <span className="text-destructive font-bold">{formatNumber(p.estoque_atual ?? 0)}</span>
                <span className="text-muted-foreground"> / {formatNumber(p.estoque_minimo)}</span>
              </p>
              <p className="text-xs text-muted-foreground">{p.unidade_medida}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
