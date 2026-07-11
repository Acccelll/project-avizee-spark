import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface KpiPorCartao {
  cartao_id: string;
  cartao_nome: string;
  ultimos4: string | null;
  total: number;
  conciliadas: number;
  valor_total: number;
}
interface KpiResult {
  total: number;
  conciliadas: number;
  pendentes: number;
  valor_total: number;
  ticket_medio: number;
  por_cartao: KpiPorCartao[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

export default function ConciliacaoCartaoDashboardPage() {
  const [params, setParams] = useSearchParams();
  const [inicio, setInicio] = useState(params.get("inicio") ?? "");
  const [fim, setFim] = useState(params.get("fim") ?? "");
  const [cartaoId, setCartaoId] = useState(params.get("cartao") ?? "");

  const cartoes = useQuery({
    queryKey: ["cartoes-credito", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes_credito").select("id, nome, ultimos4").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpi = useQuery({
    queryKey: ["conciliacao-cartao", "kpis", inicio, fim, cartaoId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cartao_dashboard_kpis", {
        p_periodo_inicio: inicio || null,
        p_periodo_fim: fim || null,
        p_cartao_id: cartaoId || null,
      });
      if (error) throw error;
      return data as unknown as KpiResult;
    },
  });

  const d = kpi.data;
  const chart = useMemo(
    () =>
      (d?.por_cartao ?? []).map((r) => ({
        name: `${r.cartao_nome}${r.ultimos4 ? ` ••${r.ultimos4}` : ""}`.slice(0, 20),
        conciliadas: r.conciliadas,
        total: r.total,
      })),
    [d],
  );

  const limpar = () => { setInicio(""); setFim(""); setCartaoId(""); setParams({}); };

  return (
    <ModulePage title="Dashboard de Conciliação de Cartão" subtitle="KPIs de faturas de cartão de crédito por período">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="grid gap-1"><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
            <div className="grid gap-1 min-w-[220px]">
              <Label>Cartão</Label>
              <Select value={cartaoId || "todos"} onValueChange={(v) => setCartaoId(v === "todos" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {cartoes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} {c.ultimos4 ? `•••• ${c.ultimos4}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(inicio || fim || cartaoId) && (
              <div className="flex items-end"><Button variant="ghost" size="sm" onClick={limpar}>Limpar (todos)</Button></div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Lançamentos</p><p className="mt-1 text-2xl font-semibold">{d?.total ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Conciliados</p><p className="mt-1 text-2xl font-semibold">{d?.conciliadas ?? 0}</p><p className="text-xs text-muted-foreground">{d ? `${((d.conciliadas / Math.max(d.total, 1)) * 100).toFixed(1)}%` : ""}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor total</p><p className="mt-1 text-2xl font-semibold">{fmt(Number(d?.valor_total ?? 0))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Ticket médio</p><p className="mt-1 text-2xl font-semibold">{fmt(Number(d?.ticket_medio ?? 0))}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Por cartão</CardTitle></CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="conciliadas" fill="hsl(var(--primary))" name="Conciliadas" />
                    <Bar dataKey="total" fill="hsl(var(--muted-foreground))" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}