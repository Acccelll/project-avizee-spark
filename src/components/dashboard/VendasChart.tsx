import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/services/relatorios/lib/fetchAllPages';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface FaturamentoPoint { mes: string; rawDate: string; valor: number; notas: number; }
interface VendasChartProps { onBarClick?: (monthStart: string, monthEnd: string) => void; }

function dates(month: string) {
  const [y, m] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`,
  };
}

export function VendasChart({ onBarClick }: VendasChartProps) {
  const navigate = useNavigate();
  const [monthsShown, setMonthsShown] = useState<6 | 12>(6);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'faturamento-historico-real'],
    queryFn: async () => {
      // Ancora o histórico na última NF de saída efetivamente registrada.
      // Mês corrente vazio não apaga a evolução comercial anterior.
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const latest = await supabase.from('notas_fiscais').select('data_emissao')
         .eq('ativo', true).eq('tipo', 'saida').in('status', ['confirmada', 'importada'])
        .lte('data_emissao', todayIso)
        .order('data_emissao', { ascending: false }).limit(1);
      if (latest.error) throw latest.error;
      if (!latest.data?.length) return { points: [] as FaturamentoPoint[], lastMonth: '' };

      const lastMonth = latest.data[0].data_emissao.slice(0, 7);
      const [year, mon] = lastMonth.split('-').map(Number);
      const first = new Date(year, mon - 12, 1);
      const start = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
      const end = dates(lastMonth).end;
      const rows = await fetchAllPages<{ data_emissao: string; valor_total: number | null }>(() =>
        supabase.from('notas_fiscais').select('data_emissao, valor_total')
          .eq('ativo', true).eq('tipo', 'saida')
          .in('status', ['confirmada', 'importada'])
          .gte('data_emissao', start).lte('data_emissao', end)
          .order('data_emissao').order('id'),
        { onTruncated: () => { throw new Error('Histórico fiscal ultrapassa limite seguro'); } },
      );
      const map = new Map<string, FaturamentoPoint>();
      for (let offset = -11; offset <= 0; offset++) {
        const d = new Date(year, mon - 1 + offset, 1);
        const rawDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map.set(rawDate, {
          rawDate, mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          valor: 0, notas: 0,
        });
      }
      for (const r of rows) {
        const p = map.get(r.data_emissao.slice(0, 7));
        if (!p) continue;
        p.valor += Number(r.valor_total ?? 0);
        p.notas += 1;
      }
      return { points: [...map.values()], lastMonth };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-full min-h-[180px] w-full" />;
  if (isError) return <div role="alert" className="p-3 text-sm text-destructive">Não foi possível carregar as notas de saída. <button type="button" className="underline" onClick={() => refetch()}>Tentar novamente</button></div>;
  if (!data?.points.length) return <div className="p-3 text-sm text-muted-foreground">Sem notas fiscais de saída válidas no cadastro. <a href="/fiscal?tipo=saida" className="underline text-primary">Consultar notas</a></div>;

  const points = data.points.slice(-monthsShown);
  const latest = data.points[data.points.length - 1];
  const previous = data.points[data.points.length - 2];
  const average = latest.notas ? latest.valor / latest.notas : 0;
  const change = previous?.valor ? (latest.valor / previous.valor - 1) * 100 : null;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isStale = data.lastMonth !== currentMonth;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Notas fiscais de saída · evolução mensal</h3>
          <p className="text-[11px] text-muted-foreground">
            Último mês com NF: {latest.mes}{isStale ? ' · mês atual sem notas' : ''}
          </p>
        </div>
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          <button type="button" onClick={() => setMonthsShown(6)} aria-pressed={monthsShown === 6}
            className={`rounded px-2 py-1 ${monthsShown === 6 ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>6 meses</button>
          <button type="button" onClick={() => setMonthsShown(12)} aria-pressed={monthsShown === 12}
            className={`rounded px-2 py-1 ${monthsShown === 12 ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>12 meses</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Último mês: <strong className="text-foreground">{formatCurrency(latest.valor)}</strong></span>
        <span>{latest.notas} NF{latest.notas !== 1 ? 's' : ''}</span>
        <span>Média/NF: {formatCurrency(average)}</span>
        {change !== null && <span className={change >= 0 ? 'text-success' : 'text-destructive'}>{change >= 0 ? '+' : ''}{change.toFixed(1)}% vs mês anterior</span>}
      </div>
      <div className="h-[205px] w-full min-w-0 md:h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}
            onClick={(e: { activePayload?: Array<{ payload: FaturamentoPoint }> }) => {
              const point = e?.activePayload?.[0]?.payload;
              if (!point) return;
              const { start, end } = dates(point.rawDate);
              if (onBarClick) onBarClick(start, end);
              else navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`);
            }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/30" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} minTickGap={18} interval="preserveStartEnd" />
            <YAxis hide yAxisId="valor" />
            <YAxis hide yAxisId="notas" orientation="right" />
            <Tooltip formatter={(value: number, name: string) => [name === 'notas' ? Number(value).toLocaleString('pt-BR') : formatCurrency(value), name === 'notas' ? 'Quantidade de NFs' : 'Valor de NF de saída']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar yAxisId="valor" dataKey="valor" name="valor" fill="hsl(var(--primary))" radius={[3,3,0,0]} maxBarSize={35} isAnimationActive={false} />
            <Line yAxisId="notas" dataKey="notas" name="notas" type="monotone" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground">Barras: valor · linha: quantidade de NFs. Inclui importadas válidas; não equivale necessariamente a vendas comerciais.</p>
    </div>
  );
}
