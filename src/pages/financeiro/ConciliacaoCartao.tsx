import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ImportarFaturaCartaoDialog } from "./conciliacaoCartao/ImportarFaturaCartaoDialog";

interface Row {
  id: string;
  data_compra: string;
  descricao: string;
  valor: number;
  parcela_atual: number | null;
  parcela_total: number | null;
  status: string;
  cartao_fatura_id: string;
  cartao_faturas: { competencia: string; cartao_id: string; cartoes_credito: { nome: string; ultimos4: string | null } } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

export default function ConciliacaoCartaoPage() {
  const [cartaoId, setCartaoId] = useState<string>("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const cartoes = useQuery({
    queryKey: ["cartoes-credito", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("id, nome, ultimos4")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lancamentos = useQuery({
    queryKey: ["conciliacao-cartao", "lancamentos", cartaoId, inicio, fim, statusFiltro],
    queryFn: async () => {
      let q = supabase
        .from("cartao_fatura_lancamentos")
        .select(
          "id, data_compra, descricao, valor, parcela_atual, parcela_total, status, cartao_fatura_id, cartao_faturas!inner(competencia, cartao_id, cartoes_credito(nome, ultimos4))",
        )
        .order("data_compra", { ascending: false })
        .limit(500);
      if (inicio) q = q.gte("data_compra", inicio);
      if (fim) q = q.lte("data_compra", fim);
      if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);
      if (cartaoId) q = q.eq("cartao_faturas.cartao_id", cartaoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = lancamentos.data ?? [];

  const kpis = useMemo(() => {
    const total = rows.length;
    const conciliados = rows.filter((r) => r.status === "conciliado").length;
    const pendentes = rows.filter((r) => r.status === "pendente").length;
    const valor = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
    return { total, conciliados, pendentes, valor };
  }, [rows]);

  return (
    <ModulePage
      title="Conciliação de Cartão de Crédito"
      subtitle="Importe faturas em PDF (C6, Inter, RecargaPay) e concilie contra os lançamentos financeiros"
      headerActions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/financeiro/conciliacao-cartao/dashboard">
              <BarChart3 className="mr-2 h-4 w-4" />Dashboard
            </Link>
          </Button>
          <ImportarFaturaCartaoDialog onImported={() => lancamentos.refetch()} />
        </div>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="grid gap-1 min-w-[220px]">
              <Label>Cartão</Label>
              <Select value={cartaoId || "todos"} onValueChange={(v) => setCartaoId(v === "todos" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os cartões</SelectItem>
                  {cartoes.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.ultimos4 ? `•••• ${c.ultimos4}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Fim</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="grid gap-1 min-w-[160px]">
              <Label>Status</Label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="conciliado">Conciliados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(cartaoId || inicio || fim || statusFiltro !== "todos") && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => { setCartaoId(""); setInicio(""); setFim(""); setStatusFiltro("todos"); }}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Lançamentos</p><p className="mt-1 text-2xl font-semibold">{kpis.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Conciliados</p><p className="mt-1 text-2xl font-semibold">{kpis.conciliados}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Pendentes</p><p className="mt-1 text-2xl font-semibold">{kpis.pendentes}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor total</p><p className="mt-1 text-2xl font-semibold">{fmt(kpis.valor)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Lançamentos</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado. Importe uma fatura para começar.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Cartão</th>
                    <th className="p-2 text-left">Competência</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-center">Parcela</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.data_compra}</td>
                      <td className="p-2">
                        {r.cartao_faturas?.cartoes_credito?.nome}
                        {r.cartao_faturas?.cartoes_credito?.ultimos4 ? ` •••• ${r.cartao_faturas.cartoes_credito.ultimos4}` : ""}
                      </td>
                      <td className="p-2">{r.cartao_faturas?.competencia}</td>
                      <td className="p-2">{r.descricao}</td>
                      <td className="p-2 text-center">
                        {r.parcela_atual && r.parcela_total ? `${r.parcela_atual}/${r.parcela_total}` : "-"}
                      </td>
                      <td className="p-2 text-right">{fmt(Number(r.valor))}</td>
                      <td className="p-2 text-center">
                        <Badge variant={r.status === "conciliado" ? "default" : "secondary"}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}