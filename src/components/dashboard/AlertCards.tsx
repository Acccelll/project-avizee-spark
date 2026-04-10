import { useNavigate } from 'react-router-dom';
import { useRelationalNavigation } from '@/contexts/RelationalNavigationContext';
import { ClipboardList, Truck, AlertTriangle } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/format';

interface AlertCardProps {
  title: string;
  count: number;
  subtitle: string;
  icon: typeof ClipboardList;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}

function AlertCard({ title, count, subtitle, icon: Icon, borderColor, iconBg, iconColor, onClick }: AlertCardProps) {
  return (
    <div className={`stat-card cursor-pointer border-l-4 ${borderColor}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1 mono">{formatNumber(count)}</p>
          <p className="text-xs mt-1 text-muted-foreground">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

interface AlertCardsProps {
  backlogCount: number;
  backlogTotal: number;
  comprasCount: number;
  comprasTotal: number;
  estoqueBaixoCount: number;
}

export function AlertCards({ backlogCount, backlogTotal, comprasCount, comprasTotal, estoqueBaixoCount }: AlertCardsProps) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <AlertCard
        title="Aguardando Faturamento"
        count={backlogCount}
        subtitle={backlogCount > 0 ? `Total: ${formatCurrency(backlogTotal)}` : 'Nenhum pedido pendente'}
        icon={ClipboardList}
        borderColor="border-l-warning"
        iconBg="bg-warning/10"
        iconColor="text-warning"
        onClick={() => navigate('/pedidos')}
      />
      <AlertCard
        title="Compras Aguardando"
        count={comprasCount}
        subtitle={comprasCount > 0 ? `Total: ${formatCurrency(comprasTotal)}` : 'Nenhuma pendente'}
        icon={Truck}
        borderColor="border-l-info"
        iconBg="bg-info/10"
        iconColor="text-info"
        onClick={() => navigate('/pedidos-compra')}
      />
      <AlertCard
        title="Estoque Mínimo"
        count={estoqueBaixoCount}
        subtitle={estoqueBaixoCount > 0 ? `${estoqueBaixoCount} produto(s) abaixo do mínimo` : 'Estoque OK'}
        icon={AlertTriangle}
        borderColor="border-l-destructive"
        iconBg="bg-destructive/10"
        iconColor="text-destructive"
        onClick={() => navigate('/estoque')}
      />
    </div>
  );
}
