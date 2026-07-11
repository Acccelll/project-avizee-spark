import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface KpiRow {
  conta_id: string;
  conta_nome: string;
  total_linhas: number;
  conciliadas: number;
  pendentes: number;
  creditos: number;
  debitos: number;
}

interface KpiTotais {
  total_linhas: number;
  conciliadas: number;
  pendentes: number;
  divergentes: number;
  ticket_medio: number;
  total_creditos: number;
  total_debitos: number;
  aprovados_total: number;
  auto_aprovados: number;
  pct_auto: number;
}

interface KpiResult {
  periodo: { inicio: string; fim: string };
  totais: KpiTotais;
  por_conta: KpiRow[];
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

export default function ConciliacaoDashboardPage() {
  const [inicio, setInicio] = useState<string>(iso(-30));
  const [fim, setFim] = useState<string>(iso(0));

  const empresaQuery = useQuery({
    queryKey: ["empresa", "atual"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const kpisQuery = useQuery({
    queryKey: ["conciliacao", "dashboard", empresaQuery.data, inicio, fim],
    enabled: Boolean(empresaQuery.data),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("conciliacao_dashboard_kpis", {
        p_empresa_id: empresaQuery.data as string,
        p_periodo_inicio: inicio,
        p_periodo_fim: fim,
      });
      if (error) throw error;
      return data as unknown as KpiResult;
    },
  });

  const totais = kpisQuery.data?.totais;
  const porConta = kpisQuery.data?.por_conta ?? [];

  const chartData = useMemo(
    () =>
      porConta.map((r) => ({
        name: r.conta_nome?.slice(0, 18) ?? r.conta_id.slice(0, 6),
        conciliadas: r.conciliadas,
        pendentes: r.pendentes,
      })),
    [porConta],
  );

  return (
    <ModulePage
      title="Dashboard de Conciliação"
      description="Visão gerencial de extratos bancários e taxa de conciliação"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Período</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="grid gap-1">
              <Label htmlFor="ini">Início</Label>
              <Input id="ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fim">Fim</Label>
              <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Linhas no período" value={totais?.total_linhas ?? 0} />
          <SummaryTile
            label="Conciliadas"
            value={totais?.conciliadas ?? 0}
            hint={totais ? `${((totais.conciliadas / Math.max(totais.total_linhas, 1)) * 100).toFixed(1)}%` : ""}
          />
          <SummaryTile label="Pendentes" value={totais?.pendentes ?? 0} />
          <SummaryTile label="% Auto-aprovadas" value={`${totais?.pct_auto ?? 0}%`} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryTile label="Créditos" value={fmtMoney(totais?.total_creditos ?? 0)} />
          <SummaryTile label="Débitos" value={fmtMoney(totais?.total_debitos ?? 0)} />
          <SummaryTile label="Ticket médio" value={fmtMoney(totais?.ticket_medio ?? 0)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por conta bancária</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="conciliadas" fill="hsl(var(--primary))" name="Conciliadas" />
                    <Bar dataKey="pendentes" fill="hsl(var(--muted-foreground))" name="Pendentes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contas ranqueadas</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs">
                <tr>
                  <th className="p-2 text-left">Conta</th>
                  <th className="p-2 text-right">Linhas</th>
                  <th className="p-2 text-right">Conciliadas</th>
                  <th className="p-2 text-right">Pendentes</th>
                  <th className="p-2 text-right">Créditos</th>
                  <th className="p-2 text-right">Débitos</th>
                </tr>
              </thead>
              <tbody>
                {porConta.map((r) => (
                  <tr key={r.conta_id} className="border-t">
                    <td className="p-2">{r.conta_nome}</td>
                    <td className="p-2 text-right">{r.total_linhas}</td>
                    <td className="p-2 text-right">{r.conciliadas}</td>
                    <td className="p-2 text-right">{r.pendentes}</td>
                    <td className="p-2 text-right">{fmtMoney(Number(r.creditos))}</td>
                    <td className="p-2 text-right">{fmtMoney(Number(r.debitos))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}