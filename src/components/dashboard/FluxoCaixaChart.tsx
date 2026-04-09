import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartPoint {
  mes: string;
  entradas_real: number;
  saidas_real: number;
  entradas_prev: number;
  saidas_prev: number;
}

export function FluxoCaixaChart() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const dateFrom = sixMonthsAgo.toISOString().slice(0, 10);

      const [{ data: realizados }, { data: previstos }] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('tipo, valor, data_pagamento')
          .eq('ativo', true)
          .eq('status', 'pago')
          .not('data_pagamento', 'is', null)
          .gte('data_pagamento', dateFrom),
        supabase
          .from('financeiro_lancamentos')
          .select('tipo, valor, data_vencimento')
          .eq('ativo', true)
          .in('status', ['aberto', 'vencido'])
          .gte('data_vencimento', dateFrom),
      ]);

      const realMap = new Map<string, { entradas_real: number; saidas_real: number }>();
      const prevMap = new Map<string, { entradas_prev: number; saidas_prev: number }>();

      for (const l of realizados || []) {
        const month = (l.data_pagamento as string).slice(0, 7);
        const current = realMap.get(month) || { entradas_real: 0, saidas_real: 0 };
        const valor = Number(l.valor || 0);
        if (l.tipo === 'receber') current.entradas_real += valor;
        else current.saidas_real += valor;
        realMap.set(month, current);
      }

      for (const l of previstos || []) {
        const month = (l.data_vencimento as string).slice(0, 7);
        const current = prevMap.get(month) || { entradas_prev: 0, saidas_prev: 0 };
        const valor = Number(l.valor || 0);
        if (l.tipo === 'receber') current.entradas_prev += valor;
        else current.saidas_prev += valor;
        prevMap.set(month, current);
      }

      const months = Array.from(new Set([...realMap.keys(), ...prevMap.keys()])).sort();
      const points: ChartPoint[] = months.map((m) => {
        const real = realMap.get(m) || { entradas_real: 0, saidas_real: 0 };
        const prev = prevMap.get(m) || { entradas_prev: 0, saidas_prev: 0 };
        const [year, mon] = m.split('-');
        const mesLabel = new Date(Number(year), Number(mon) - 1).toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        });
        return {
          mes: mesLabel,
          entradas_real: real.entradas_real,
          saidas_real: real.saidas_real,
          entradas_prev: prev.entradas_prev,
          saidas_prev: prev.saidas_prev,
        };
      });

      setData(points);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-semibold text-foreground mb-4">Fluxo de Caixa</h3>
        <p className="text-sm text-muted-foreground text-center py-8">Sem dados financeiros para exibir.</p>
      </div>
    );
  }

  return (
    <figure className="bg-card rounded-xl border p-5" role="img" aria-label="Gráfico de área do fluxo de caixa dos últimos seis meses com séries de recebimentos e pagamentos realizados e previstos.">
      <h3 className="font-semibold text-foreground mb-4">Fluxo de Caixa — Realizado vs Previsto (6 meses)</h3>
      <div
        role="img"
        aria-label={`Gráfico de área: fluxo de caixa dos últimos 6 meses. ${data.map((p) => `${p.mes}: recebimentos realizados ${formatCurrency(p.entradas_real)}, pagamentos realizados ${formatCurrency(p.saidas_real)}`).join('; ')}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis hide />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'entradas_real'
                  ? 'Recebimentos realizados'
                  : name === 'saidas_real'
                    ? 'Pagamentos realizados'
                    : name === 'entradas_prev'
                      ? 'A receber (previsto)'
                      : 'A pagar (previsto)',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="entradas_real" stroke="hsl(142 76% 36%)" fill="url(#colorEntradas)" strokeWidth={2} />
            <Area type="monotone" dataKey="saidas_real" stroke="hsl(0 84% 60%)" fill="url(#colorSaidas)" strokeWidth={2} />
            <Area type="monotone" dataKey="entradas_prev" stroke="hsl(142 76% 36%)" fill="none" strokeDasharray="5 3" strokeWidth={1.5} opacity={0.6} />
            <Area type="monotone" dataKey="saidas_prev" stroke="hsl(0 84% 60%)" fill="none" strokeDasharray="5 3" strokeWidth={1.5} opacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Accessible data table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>Fluxo de Caixa — Realizado vs Previsto (6 meses)</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Recebimentos Realizados</th>
              <th scope="col">Pagamentos Realizados</th>
              <th scope="col">A Receber (Previsto)</th>
              <th scope="col">A Pagar (Previsto)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.mes}>
                <td>{p.mes}</td>
                <td>{formatCurrency(p.entradas_real)}</td>
                <td>{formatCurrency(p.saidas_real)}</td>
                <td>{formatCurrency(p.entradas_prev)}</td>
                <td>{formatCurrency(p.saidas_prev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-6 mt-3 text-xs text-muted-foreground justify-center flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[hsl(142_76%_36%)]" />Recebimentos realizados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[hsl(0_84%_60%)]" />Pagamentos realizados
        </span>
        <span className="flex items-center gap-1.5 opacity-60">
          <span className="w-3 border-t border-dashed border-[hsl(142_76%_36%)]" />A receber (previsto)
        </span>
        <span className="flex items-center gap-1.5 opacity-60">
          <span className="w-3 border-t border-dashed border-[hsl(0_84%_60%)]" />A pagar (previsto)
        </span>
      </div>
      <figcaption className="sr-only">
        O gráfico compara recebimentos e pagamentos realizados com valores previstos para facilitar o acompanhamento do caixa.
      </figcaption>
    </figure>
  );
}
