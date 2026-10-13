import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/services/relatorios/lib/fetchAllPages';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import type { FluxoCaixaFinanceiroRow } from '@/types/database-views';

interface ChartPoint {
  mes: string;
  chave: string;
  recebido: number;
  aReceber: number;
  pago: number;
  aPagar: number;
}

interface FluxoCaixaChartProps {
  embedded?: boolean;
}

const SERIES = {
  recebido: 'Recebido',
  aReceber: 'A receber (pendente)',
  pago: 'Pago',
  aPagar: 'A pagar (pendente)',
} as const;

function isoMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function FluxoCaixaChart({ embedded = false }: FluxoCaixaChartProps) {
  const { data = [], isLoading, isError, refetch } = useQuery<ChartPoint[]>({
    queryKey: ['dashboard', 'fluxo-caixa', 'realizado-previsto-unificado'],
    queryFn: async () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 4, 0);
      const dateFrom = `${isoMonth(first)}-01`;
      const dateTo = `${isoMonth(last)}-${String(last.getDate()).padStart(2, '0')}`;

      // A view distingue baixa efetiva de saldo ainda pendente: somar cada categoria
      // apenas uma vez evita contabilizar um título pago como previsão novamente.
      const rows = await fetchAllPages<FluxoCaixaFinanceiroRow>(() =>
        supabase.from('vw_fluxo_caixa_financeiro')
          .select('tipo, valor, data_ref, categoria')
          .gte('data_ref', dateFrom).lte('data_ref', dateTo)
          .order('data_ref').order('tipo').order('categoria'),
        { onTruncated: () => { throw new Error('Fluxo de caixa excedeu o limite de consulta'); } },
      );

      const months = new Map<string, ChartPoint>();
      for (let i = -5; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const chave = isoMonth(d);
        months.set(chave, {
          chave,
          mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          recebido: 0, aReceber: 0, pago: 0, aPagar: 0,
        });
      }
      for (const r of rows) {
        if (!r.data_ref) continue;
        const p = months.get(r.data_ref.slice(0, 7));
        if (!p) continue;
        const amount = Number(r.valor ?? 0);
        if (r.categoria === 'realizado') {
          if (r.tipo === 'receber') p.recebido += amount;
          if (r.tipo === 'pagar') p.pago -= amount;
        } else if (r.categoria === 'previsto') {
          if (r.tipo === 'receber') p.aReceber += amount;
          if (r.tipo === 'pagar') p.aPagar -= amount;
        }
      }
      return [...months.values()];
    },
    staleTime: 2 * 60 * 1000,
  });

  const today = isoMonth(new Date());
  const content = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fluxo financeiro · realizado + pendente</h3>
          <p className="text-[11px] text-muted-foreground">6 meses anteriores/incluindo atual + 3 futuros · saída abaixo de zero</p>
        </div>
        <a href="/fluxo-caixa" className="text-xs text-primary hover:underline">Detalhar →</a>
      </div>
      <div className="min-h-[160px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/30" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis hide />
            <Tooltip
              formatter={(raw: number, name: string) => [formatCurrency(Math.abs(Number(raw))), SERIES[name as keyof typeof SERIES] || name]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="recebido" stackId="entradas" fill="hsl(142 76% 36%)" isAnimationActive={false} />
            <Bar dataKey="aReceber" stackId="entradas" fill="hsl(142 45% 68%)" isAnimationActive={false} />
            <Bar dataKey="pago" stackId="saidas" fill="hsl(0 75% 51%)" isAnimationActive={false} />
            <Bar dataKey="aPagar" stackId="saidas" fill="hsl(0 65% 78%)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>■ Recebido</span><span>□ A receber</span><span>■ Pago</span><span>□ A pagar</span>
        <span>Atual: {today}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">Previsões = saldos não baixados por vencimento, inclusive atrasados; não são saldo bancário.</p>
    </div>
  );

  if (isLoading) return <Skeleton className={embedded ? 'h-full w-full' : 'h-64 w-full'} />;
  if (isError) return <div role="alert" className="text-sm text-destructive">Erro ao consultar fluxo de caixa. <button type="button" className="underline" onClick={() => refetch()}>Tentar novamente</button></div>;
  if (!data.some(p => p.recebido || p.aReceber || p.pago || p.aPagar)) {
    return <p className="text-sm text-muted-foreground p-3">Sem movimentos realizados ou previstos nesta janela. <a className="text-primary underline" href="/fluxo-caixa">Abrir fluxo completo</a></p>;
  }
  if (embedded) return content;
  return <div className="bg-card rounded-xl border p-4 h-[300px]">{content}</div>;
}
