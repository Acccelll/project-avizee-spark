import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardPeriod } from '@/contexts/DashboardPeriodContext';

interface VendasPoint {
  mes: string;
  valor: number;
  rawDate: string;
}

interface VendasChartProps {
  /** Called with the ISO month string (YYYY-MM) when user clicks a bar. */
  onBarClick?: (monthStart: string, monthEnd: string) => void;
}

/** Converts a "YYYY-MM" string into {label, start, end}. */
function parseMonth(rawDate: string) {
  const [year, mon] = rawDate.split('-');
  const y = Number(year);
  const m = Number(mon);
  const label = new Date(y, m - 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
  const start = `${year}-${mon}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;
  return { label, start, end };
}

export function VendasChart({ onBarClick }: VendasChartProps) {
  const navigate = useNavigate();
  const { range } = useDashboardPeriod();
  const { data = [], isLoading: loading } = useQuery<VendasPoint[]>({
    queryKey: ['dashboard', 'vendas-6m', range.dateTo],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const dateFrom = sixMonthsAgo.toISOString().slice(0, 10);
      const dateTo = range.dateTo || new Date().toISOString().slice(0, 10);

      const { data: rows } = await supabase
        .from('notas_fiscais')
        .select('valor_total, data_emissao')
        .eq('ativo', true)
        .eq('tipo', 'saida')
        .eq('status', 'confirmada')
        .gte('data_emissao', dateFrom)
        .lte('data_emissao', dateTo);

      const monthMap = new Map<string, number>();
      for (const row of rows || []) {
        const month = (row.data_emissao as string).slice(0, 7);
        monthMap.set(month, (monthMap.get(month) ?? 0) + Number(row.valor_total || 0));
      }

      const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      return sorted.map(([month, valor]) => ({
        mes: parseMonth(month).label,
        valor,
        rawDate: month,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });

interface RechartsClickPayload {
  activePayload?: Array<{ payload: VendasPoint }>;
}

  const handleBarClick = (payload: RechartsClickPayload) => {
    if (!payload?.activePayload?.[0]) return;
    const point = payload.activePayload[0].payload as VendasPoint;
    const { start, end } = parseMonth(point.rawDate);

    if (onBarClick) {
      onBarClick(start, end);
    } else {
      navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full space-y-3">
        <Skeleton className="h-5 w-48 shrink-0" />
        <Skeleton className="flex-1 w-full min-h-[160px]" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem dados de faturamento para exibir.
      </p>
    );
  }

  return (
    <figure
      role="img"
      aria-label="Gráfico de barras de faturamento mensal dos últimos 6 meses. Clique em uma barra para detalhar o relatório de vendas."
      className="flex flex-col h-full"
    >
      <h3 className="mb-3 font-semibold text-foreground text-sm shrink-0">
        Faturamento — últimos 6 meses
        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(janela fixa)</span>
      </h3>
      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          onClick={handleBarClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis hide />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar
            dataKey="valor"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Clique em uma barra para navegar ao relatório de vendas filtrado pelo mês correspondente.
      </figcaption>
    </figure>
  );
}
