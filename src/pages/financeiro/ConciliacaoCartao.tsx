import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, Lock, CircleDollarSign, ExternalLink, RefreshCw, EyeOff, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { gerarFaturaCartao, listLancamentosDaFatura } from "@/services/cartoesCredito.service";
import { ImportarFaturaCartaoDialog } from "./conciliacaoCartao/ImportarFaturaCartaoDialog";
import { ImportarOfxCartaoDialog } from "./conciliacaoCartao/ImportarOfxCartaoDialog";
import { BaixarFaturaDialog } from "./conciliacaoCartao/BaixarFaturaDialog";
import {
  listLinhasDaFatura,
  setLinhaStatus,
  type FaturaLinhaStatus,
} from "@/services/conciliacaoCartao/faturaLinhas.service";

interface FaturaRow {
  id: string;
  cartao_id: string;
  competencia: string;
  data_fechamento: string | null;
  data_vencimento: string | null;
  valor_total: number;
  status: string;
  cartoes_credito: { nome: string; ultimos4: string | null } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ConciliacaoCartaoPage() {
  const qc = useQueryClient();
  const [cartaoId, setCartaoId] = useState<string>("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [faturaSelecionadaId, setFaturaSelecionadaId] = useState<string | null>(null);
  const [baixarOpen, setBaixarOpen] = useState(false);

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

  const faturas = useQuery({
    queryKey: ["cartao-faturas", "conciliacao-cartao", cartaoId, inicio, fim, statusFiltro],
    queryFn: async () => {
      let q = supabase
        .from("cartao_faturas")
        .select("id, cartao_id, competencia, data_fechamento, data_vencimento, valor_total, status, cartoes_credito(nome, ultimos4)")
        .order("data_vencimento", { ascending: false })
        .limit(200);
      if (cartaoId) q = q.eq("cartao_id", cartaoId);
      if (inicio) q = q.gte("data_vencimento", inicio);
      if (fim) q = q.lte("data_vencimento", fim);
      if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FaturaRow[];
    },
  });

  const rows = faturas.data ?? [];

  const kpis = useMemo(() => {
    const abertas = rows.filter((r) => r.status === "aberta");
    const fechadas = rows.filter((r) => r.status === "fechada");
    const pagas = rows.filter((r) => r.status === "paga");
    const aPagar = [...abertas, ...fechadas].reduce((s, r) => s + Number(r.valor_total || 0), 0);
    return { abertas: abertas.length, fechadas: fechadas.length, pagas: pagas.length, aPagar };
  }, [rows]);

  const faturaSel = rows.find((r) => r.id === faturaSelecionadaId) ?? null;

  const lancamentos = useQuery({
    queryKey: ["cartao-faturas", "lancamentos", faturaSelecionadaId],
    enabled: !!faturaSelecionadaId,
    queryFn: () => listLancamentosDaFatura(faturaSelecionadaId as string),
  });

  const fechar = useMutation({
    mutationFn: async (fatura: FaturaRow) => gerarFaturaCartao(fatura.cartao_id, fatura.competencia),
    onSuccess: (res, fatura) => {
      if (res.ok) {
        toast.success(`Fatura ${fatura.competencia} atualizada — total ${fmt(Number(res.valor_total ?? 0))}`);
      } else {
        toast.error(res.erro ?? "Falha ao fechar fatura");
      }
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      qc.invalidateQueries({ queryKey: ["financeiro_lancamentos"] });
    },
    onError: (err) => {
      logger.error("conciliacao_cartao.fechar", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao fechar fatura");
    },
  });

  const abrirBaixar = (fatura: FaturaRow) => {
    setFaturaSelecionadaId(fatura.id);
    setBaixarOpen(true);
  };

  return (
    <ModulePage
      title="Conciliação de Cartão de Crédito"
      subtitle="Importe faturas em PDF, feche a competência e baixe o pagamento para conciliar no banco"
      headerActions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/financeiro/conciliacao-cartao/dashboard">
              <BarChart3 className="mr-2 h-4 w-4" />Dashboard
            </Link>
          </Button>
          <ImportarOfxCartaoDialog onImported={() => faturas.refetch()} />
          <ImportarFaturaCartaoDialog onImported={() => faturas.refetch()} />
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
              <Label>Vencimento de</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Vencimento até</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="grid gap-1 min-w-[160px]">
              <Label>Status</Label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberta">Abertas</SelectItem>
                  <SelectItem value="fechada">Fechadas</SelectItem>
                  <SelectItem value="paga">Pagas</SelectItem>
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
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Abertas</p><p className="mt-1 text-2xl font-semibold">{kpis.abertas}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Fechadas</p><p className="mt-1 text-2xl font-semibold">{kpis.fechadas}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Pagas</p><p className="mt-1 text-2xl font-semibold">{kpis.pagas}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor a pagar</p><p className="mt-1 text-2xl font-semibold">{fmt(kpis.aPagar)}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Coluna esquerda: faturas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturas ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {faturas.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma fatura encontrada. Importe uma fatura em PDF para começar.
                </p>
              ) : rows.map((r) => {
                const isSel = r.id === faturaSelecionadaId;
                const podeFechar = r.status === "aberta";
                const podeBaixar = r.status === "fechada";
                return (
                  <div
                    key={r.id}
                    onClick={() => setFaturaSelecionadaId(r.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.competencia} · {r.cartoes_credito?.nome ?? "Cartão"}
                          {r.cartoes_credito?.ultimos4 ? ` •••• ${r.cartoes_credito.ultimos4}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fechamento {fmtDate(r.data_fechamento)} · Vencimento {fmtDate(r.data_vencimento)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{fmt(Number(r.valor_total || 0))}</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {podeFechar && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fechar.isPending}
                          onClick={(e) => { e.stopPropagation(); fechar.mutate(r); }}
                        >
                          <Lock className="mr-1 h-3.5 w-3.5" />Fechar fatura
                        </Button>
                      )}
                      {r.status !== "paga" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={fechar.isPending}
                          onClick={(e) => { e.stopPropagation(); fechar.mutate(r); }}
                          title="Recalcular total agregando os lançamentos do período"
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />Recalcular
                        </Button>
                      )}
                      {podeBaixar && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); abrirBaixar(r); }}
                        >
                          <CircleDollarSign className="mr-1 h-3.5 w-3.5" />Baixar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Coluna direita: lançamentos da fatura */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {faturaSel
                  ? `Lançamentos da fatura ${faturaSel.competencia}`
                  : "Lançamentos da fatura"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!faturaSel ? (
                <p className="text-sm text-muted-foreground">Selecione uma fatura à esquerda para ver os lançamentos agrupados.</p>
              ) : lancamentos.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (lancamentos.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem lançamentos vinculados. Importe a fatura ou clique em <strong>Recalcular</strong>.
                </p>
              ) : (
                <div className="max-h-[520px] space-y-1 overflow-auto pr-1">
                  {(lancamentos.data ?? []).map((l) => (
                    <div
                      key={l.id}
                      className="group flex items-center justify-between gap-2 rounded border p-2 text-sm hover:bg-muted/50"
                      onDoubleClick={() => window.open(`/financeiro/${l.id}`, "_blank", "noopener,noreferrer")}
                      title="Duplo clique para abrir o lançamento"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{l.descricao ?? "(sem descrição)"}</p>
                        <p className="text-xs text-muted-foreground">
                          Venc. {fmtDate(l.data_vencimento)}
                          {l.parcela_numero && l.parcela_total ? ` · ${l.parcela_numero}/${l.parcela_total}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">{fmt(l.valor)}</span>
                        <StatusBadge status={l.status} />
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BaixarFaturaDialog
        open={baixarOpen}
        onOpenChange={setBaixarOpen}
        faturaId={faturaSel?.id ?? null}
        faturaLabel={faturaSel ? `${faturaSel.competencia} · ${faturaSel.cartoes_credito?.nome ?? ""}` : undefined}
        valorTotal={faturaSel ? Number(faturaSel.valor_total || 0) : undefined}
        dataVencimento={faturaSel?.data_vencimento ?? undefined}
      />
    </ModulePage>
  );
}