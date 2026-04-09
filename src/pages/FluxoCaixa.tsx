import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { SummaryCard } from "@/components/SummaryCard";
import { DataTable } from "@/components/DataTable";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { FormModal } from "@/components/FormModal";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle,
  Plus, Upload, BarChart2, List, Building2, FileDown,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Lancamento {
  id: string; tipo: string; valor: number; status: string;
  data_vencimento: string; data_pagamento: string | null;
  conta_bancaria_id: string | null; descricao: string;
  forma_pagamento: string | null; nota_fiscal_id: string | null;
  documento_pai_id: string | null; observacoes: string | null;
  contas_bancarias?: { descricao: string; bancos?: { nome: string } } | null;
}

interface ContaBancaria {
  id: string; descricao: string; saldo_atual: number;
  bancos?: { nome: string };
}

type Periodicidade = "diaria" | "semanal" | "mensal";

const emptyForm: Record<string, any> = {
  tipo: "receber", descricao: "", valor: 0,
  data_vencimento: new Date().toISOString().split("T")[0],
  status: "aberto", forma_pagamento: "", conta_bancaria_id: "", observacoes: "",
};

const tipoOpts: MultiSelectOption[] = [
  { value: "receber", label: "A Receber" },
  { value: "pagar", label: "A Pagar" },
];

const statusOpts: MultiSelectOption[] = [
  { value: "aberto", label: "Aberto" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

const getEffectiveStatus = (l: Lancamento, hoje: Date): string => {
  if (l.status === "pago" || l.status === "cancelado") return l.status;
  const venc = new Date(l.data_vencimento + "T00:00:00");
  if (venc < hoje) return "vencido";
  return l.status;
};

const FluxoCaixa = () => {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [filterBanco, setFilterBanco] = useState("todos");
  const [viewMode, setViewMode] = useState<"painel" | "movimentos">("painel");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });

  // Movements filters
  const [movSearch, setMovSearch] = useState("");
  const [movTipoFilters, setMovTipoFilters] = useState<string[]>([]);
  const [movStatusFilters, setMovStatusFilters] = useState<string[]>([]);

  // Lançamento manual
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // CSV Import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
  const [csvFile, setCsvFile] = useState<string>("");
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: lancs }, { data: contas }] = await Promise.all([
      supabase.from("financeiro_lancamentos")
        .select("id, tipo, valor, status, data_vencimento, data_pagamento, conta_bancaria_id, descricao, forma_pagamento, nota_fiscal_id, documento_pai_id, observacoes, contas_bancarias(descricao, bancos(nome))")
        .eq("ativo", true)
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim),
      supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true),
    ]);
    setLancamentos((lancs as Lancamento[]) || []);
    setContasBancarias((contas as ContaBancaria[]) || []);
    setLoading(false);
  }, [dataInicio, dataFim]);

  useEffect(() => { reload(); }, [reload]);

  // ─── Analytical (painel) ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filterBanco === "todos") return lancamentos;
    return lancamentos.filter(l => l.conta_bancaria_id === filterBanco);
  }, [lancamentos, filterBanco]);

  const grouped = useMemo(() => {
    const groups: Record<string, { prevReceber: number; prevPagar: number; realReceber: number; realPagar: number; items: Lancamento[] }> = {};

    const getKey = (dateStr: string): string => {
      const d = new Date(dateStr + "T00:00:00");
      if (periodicidade === "diaria") return d.toISOString().split("T")[0];
      if (periodicidade === "semanal") {
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        return `Sem ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
      }
      return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    };

    filtered.forEach(l => {
      const key = getKey(l.data_vencimento);
      if (!groups[key]) groups[key] = { prevReceber: 0, prevPagar: 0, realReceber: 0, realPagar: 0, items: [] };
      const g = groups[key];
      g.items.push(l);
      const val = Number(l.valor || 0);
      if (l.tipo === "receber") {
        g.prevReceber += val;
        if (l.status === "pago") g.realReceber += val;
      } else {
        g.prevPagar += val;
        if (l.status === "pago") g.realPagar += val;
      }
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, periodicidade]);

  const totals = useMemo(() => {
    let prevReceber = 0, prevPagar = 0, realReceber = 0, realPagar = 0;
    filtered.forEach(l => {
      const val = Number(l.valor || 0);
      if (l.tipo === "receber") { prevReceber += val; if (l.status === "pago") realReceber += val; }
      else { prevPagar += val; if (l.status === "pago") realPagar += val; }
    });
    return { prevReceber, prevPagar, realReceber, realPagar, saldoPrevisto: prevReceber - prevPagar, saldoRealizado: realReceber - realPagar };
  }, [filtered]);

  const chartData = useMemo(() => {
    let saldoAcumPrev = 0;
    let saldoAcumReal = 0;
    return grouped.map(([key, g]) => {
      saldoAcumPrev += (g.prevReceber - g.prevPagar);
      saldoAcumReal += (g.realReceber - g.realPagar);
      const label = periodicidade === "diaria"
        ? new Date(key + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : key;
      return { name: label, previsto: saldoAcumPrev, realizado: saldoAcumReal };
    });
  }, [grouped, periodicidade]);

  const hasNegativeRisk = chartData.some(d => d.previsto < 0);

  // ─── Movements DataTable ──────────────────────────────────────────────────
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const hojeStr = hoje.toISOString().split("T")[0];

  const movFiltered = useMemo(() => {
    let result = filtered;
    if (movTipoFilters.length) result = result.filter(l => movTipoFilters.includes(l.tipo));
    if (movStatusFilters.length) result = result.filter(l => movStatusFilters.includes(getEffectiveStatus(l, hoje)));
    if (movSearch.trim()) {
      const q = movSearch.trim().toLowerCase();
      result = result.filter(l =>
        l.descricao?.toLowerCase().includes(q) ||
        l.contas_bancarias?.descricao?.toLowerCase().includes(q) ||
        l.contas_bancarias?.bancos?.nome?.toLowerCase().includes(q) ||
        l.forma_pagamento?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [filtered, movTipoFilters, movStatusFilters, movSearch, hoje]);

  const movActiveFilters: FilterChip[] = [
    ...movTipoFilters.map(v => ({ key: "tipo", label: "Tipo", value: v, displayValue: v === "receber" ? "A Receber" : "A Pagar" })),
    ...movStatusFilters.map(v => ({ key: "status", label: "Status", value: v, displayValue: statusOpts.find(o => o.value === v)?.label ?? v })),
  ];

  const handleRemoveMov = (key: string, value?: string) => {
    if (key === "tipo") setMovTipoFilters(p => p.filter(x => x !== value));
    if (key === "status") setMovStatusFilters(p => p.filter(x => x !== value));
  };

  const movColumns = [
    {
      key: "data_vencimento", label: "Vencimento", sortable: true,
      render: (l: Lancamento) => {
        const es = getEffectiveStatus(l, hoje);
        const isOverdue = es === "vencido";
        const isToday = l.data_vencimento === hojeStr;
        const [y, m, d] = l.data_vencimento.split("-").map(Number);
        const venc = new Date(y, m - 1, d);
        return (
          <div className="space-y-0.5">
            <span className={`text-sm ${isOverdue ? "text-destructive font-semibold" : isToday ? "text-warning font-semibold" : ""}`}>
              {venc.toLocaleDateString("pt-BR")}
            </span>
            {isToday && !isOverdue && <span className="text-[10px] text-warning font-medium block">Vence hoje</span>}
          </div>
        );
      },
    },
    {
      key: "tipo", label: "Tipo", sortable: true,
      render: (l: Lancamento) => (
        <Badge variant="outline" className={l.tipo === "receber"
          ? "border-success/40 text-success bg-success/5 whitespace-nowrap"
          : "border-destructive/40 text-destructive bg-destructive/5 whitespace-nowrap"}>
          {l.tipo === "receber" ? "Receber" : "Pagar"}
        </Badge>
      ),
    },
    {
      key: "descricao", label: "Descrição", sortable: true,
      render: (l: Lancamento) => <span className="text-sm">{l.descricao}</span>,
    },
    {
      key: "valor", label: "Valor", sortable: true,
      render: (l: Lancamento) => (
        <span className={`font-semibold font-mono text-sm ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}>
          {l.tipo === "receber" ? "+" : "-"}{formatCurrency(Number(l.valor))}
        </span>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (l: Lancamento) => <StatusBadge status={getEffectiveStatus(l, hoje)} />,
    },
    {
      key: "origem", label: "Origem", hidden: true,
      render: (l: Lancamento) => {
        if (l.nota_fiscal_id) return <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 whitespace-nowrap">NF Fiscal</Badge>;
        if (l.documento_pai_id) return <Badge variant="outline" className="text-xs whitespace-nowrap">Parcelamento</Badge>;
        return <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">Manual</Badge>;
      },
    },
    {
      key: "forma_pagamento", label: "Forma Pgto", hidden: true,
      render: (l: Lancamento) => l.forma_pagamento
        ? <span className="text-xs">{l.forma_pagamento}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "conta_bancaria", label: "Banco/Conta", hidden: true,
      render: (l: Lancamento) => {
        if (!l.contas_bancarias) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs">{l.contas_bancarias.bancos?.nome} — {l.contas_bancarias.descricao}</span>;
      },
    },
  ];

  // ─── Lançamento manual ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || !form.valor) { toast.error("Descrição e valor são obrigatórios"); return; }
    if (form.status === "pago" && !form.conta_bancaria_id) {
      toast.error("Conta bancária é obrigatória para lançamentos pagos"); return;
    }
    setSaving(true);
    try {
      await supabase.from("financeiro_lancamentos").insert({
        tipo: form.tipo, descricao: form.descricao,
        valor: Number(form.valor),
        data_vencimento: form.data_vencimento,
        status: form.status,
        forma_pagamento: form.forma_pagamento || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        observacoes: form.observacoes || null,
        ativo: true,
      } as any);
      toast.success("Lançamento registrado com sucesso");
      setModalOpen(false);
      setForm({ ...emptyForm });
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao registrar lançamento: ${msg}`);
    }
    setSaving(false);
  };

  // ─── CSV import ───────────────────────────────────────────────────────────
  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(";").map(h => h.trim().toLowerCase().replace(/[""]/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(";").map(v => v.trim().replace(/[""]/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    }).filter(r => Object.values(r).some(v => v));
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleCsvImport = async () => {
    if (!csvRows.length) { toast.error("Nenhum registro encontrado no arquivo"); return; }
    setCsvImporting(true);
    let ok = 0, fail = 0;
    for (const row of csvRows) {
      const data = row["data"] || row["data_vencimento"] || row["date"] || "";
      const descricao = row["descricao"] || row["description"] || row["historico"] || "";
      const rawValor = (row["valor"] || row["value"] || row["amount"] || "0").replace(",", ".");
      const valor = parseFloat(rawValor);
      const tipo = (row["tipo"] || row["type"] || "").toLowerCase().includes("pagar") ? "pagar" : "receber";

      if (!data || !descricao || isNaN(valor) || valor <= 0) { fail++; continue; }

      const { error } = await supabase.from("financeiro_lancamentos").insert({
        tipo, descricao, valor,
        data_vencimento: data, status: "aberto", ativo: true,
      } as any);
      if (error) fail++; else ok++;
    }
    setCsvImporting(false);
    if (ok > 0) toast.success(`${ok} lançamento(s) importado(s) com sucesso${fail > 0 ? ` (${fail} ignorado(s))` : ""}`);
    else toast.error("Nenhum registro pôde ser importado. Verifique o formato do arquivo.");
    if (ok > 0) { setCsvOpen(false); setCsvRows([]); setCsvFile(""); await reload(); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <ModulePage
        title="Fluxo de Caixa"
        subtitle={`Comportamento do caixa de ${new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`}
        headerActions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setCsvOpen(true)}>
              <Upload className="w-3.5 h-3.5" /> Importar CSV
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Lançar
            </Button>
          </>
        }
      >
        {/* ── Period + bank filters ── */}
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-xl border">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Período de</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">até</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Agrupamento</Label>
            <div className="flex gap-1">
              {(["diaria", "semanal", "mensal"] as Periodicidade[]).map(p => (
                <Button key={p} size="sm" variant={periodicidade === p ? "default" : "outline"} onClick={() => setPeriodicidade(p)}>
                  {p === "diaria" ? "Diária" : p === "semanal" ? "Semanal" : "Mensal"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Conta / Banco</Label>
            <Select value={filterBanco} onValueChange={setFilterBanco}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Consolidado</SelectItem>
                {contasBancarias.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.bancos?.nome} — {c.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Entradas Previstas"
            value={formatCurrency(totals.prevReceber)}
            subtitle={`Realizado: ${formatCurrency(totals.realReceber)}`}
            icon={TrendingUp} variant="success"
          />
          <SummaryCard
            title="Saídas Previstas"
            value={formatCurrency(totals.prevPagar)}
            subtitle={`Realizado: ${formatCurrency(totals.realPagar)}`}
            icon={TrendingDown} variant="danger"
          />
          <SummaryCard
            title="Saldo Previsto"
            value={formatCurrency(totals.saldoPrevisto)}
            icon={Wallet}
            variant={totals.saldoPrevisto >= 0 ? "success" : "danger"}
          />
          <SummaryCard
            title="Saldo Realizado"
            value={formatCurrency(totals.saldoRealizado)}
            icon={Wallet}
            variant={totals.saldoRealizado >= 0 ? "info" : "danger"}
          />
        </div>

        {/* ── Risk alert ── */}
        {hasNegativeRisk && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              Atenção: o saldo previsto ficará negativo em algum período. Considere antecipar recebíveis ou postergar pagamentos.
            </span>
          </div>
        )}

        {/* ── View mode toggle ── */}
        <div className="flex gap-1 mb-4">
          <Button size="sm" variant={viewMode === "painel" ? "default" : "outline"} className="gap-2" onClick={() => setViewMode("painel")}>
            <BarChart2 className="w-3.5 h-3.5" /> Painel
          </Button>
          <Button size="sm" variant={viewMode === "movimentos" ? "default" : "outline"} className="gap-2" onClick={() => setViewMode("movimentos")}>
            <List className="w-3.5 h-3.5" /> Movimentos ({movFiltered.length})
          </Button>
        </div>

        {viewMode === "painel" ? (
          <>
            {/* ── Chart ── */}
            {chartData.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Saldo Acumulado — Previsto vs Realizado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Area type="monotone" dataKey="previsto" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} name="Previsto" />
                        <Area type="monotone" dataKey="realizado" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.15)" strokeWidth={2} name="Realizado" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Grouped flow table ── */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : grouped.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Nenhum lançamento encontrado no período selecionado.</div>
            ) : (
              <div className="bg-card rounded-xl border overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold">Período</th>
                      <th className="text-right p-3 font-semibold text-success">Entradas Prev.</th>
                      <th className="text-right p-3 font-semibold text-success/80">Entradas Real.</th>
                      <th className="text-right p-3 font-semibold text-destructive">Saídas Prev.</th>
                      <th className="text-right p-3 font-semibold text-destructive/80">Saídas Real.</th>
                      <th className="text-right p-3 font-semibold">Saldo Previsto</th>
                      <th className="text-right p-3 font-semibold">Saldo Realizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let saldoAcumPrev = 0;
                      let saldoAcumReal = 0;
                      return grouped.map(([key, g]) => {
                        saldoAcumPrev += (g.prevReceber - g.prevPagar);
                        saldoAcumReal += (g.realReceber - g.realPagar);
                        return (
                          <tr key={key} className="border-b hover:bg-muted/10">
                            <td className="p-3 font-medium">
                              {periodicidade === "diaria"
                                ? new Date(key + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
                                : key}
                            </td>
                            <td className="p-3 text-right mono text-success">{formatCurrency(g.prevReceber)}</td>
                            <td className="p-3 text-right mono text-success/70">{formatCurrency(g.realReceber)}</td>
                            <td className="p-3 text-right mono text-destructive">{formatCurrency(g.prevPagar)}</td>
                            <td className="p-3 text-right mono text-destructive/70">{formatCurrency(g.realPagar)}</td>
                            <td className={`p-3 text-right mono font-semibold ${saldoAcumPrev >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(saldoAcumPrev)}
                            </td>
                            <td className={`p-3 text-right mono font-semibold ${saldoAcumReal >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(saldoAcumReal)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-bold">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-right mono text-success">{formatCurrency(totals.prevReceber)}</td>
                      <td className="p-3 text-right mono text-success/70">{formatCurrency(totals.realReceber)}</td>
                      <td className="p-3 text-right mono text-destructive">{formatCurrency(totals.prevPagar)}</td>
                      <td className="p-3 text-right mono text-destructive/70">{formatCurrency(totals.realPagar)}</td>
                      <td className={`p-3 text-right mono ${totals.saldoPrevisto >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totals.saldoPrevisto)}</td>
                      <td className={`p-3 text-right mono ${totals.saldoRealizado >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totals.saldoRealizado)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          /* ── Movements tab with DataTable + column toggle ── */
          <>
            <AdvancedFilterBar
              searchValue={movSearch}
              onSearchChange={setMovSearch}
              searchPlaceholder="Buscar por descrição, conta ou forma de pagamento..."
              activeFilters={movActiveFilters}
              onRemoveFilter={handleRemoveMov}
              onClearAll={() => { setMovTipoFilters([]); setMovStatusFilters([]); }}
              count={movFiltered.length}
            >
              <MultiSelect options={tipoOpts} selected={movTipoFilters} onChange={setMovTipoFilters} placeholder="Tipo" className="w-[150px]" />
              <MultiSelect options={statusOpts} selected={movStatusFilters} onChange={setMovStatusFilters} placeholder="Status" className="w-[160px]" />
            </AdvancedFilterBar>

            <DataTable
              columns={movColumns}
              data={movFiltered}
              loading={loading}
              moduleKey="fluxo-caixa-movimentos"
              showColumnToggle={true}
              emptyTitle="Nenhum movimento encontrado"
              emptyDescription="Ajuste os filtros ou registre novos lançamentos."
            />
          </>
        )}

        {/* ── Bank accounts ── */}
        {contasBancarias.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Contas Bancárias
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contasBancarias.map(c => (
                <div
                  key={c.id}
                  className={`stat-card cursor-pointer transition-all ${filterBanco === c.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setFilterBanco(filterBanco === c.id ? "todos" : c.id)}
                >
                  <p className="text-xs text-muted-foreground font-medium">{c.bancos?.nome}</p>
                  <p className="text-sm font-medium mt-0.5">{c.descricao}</p>
                  <p className={`text-lg font-bold mono mt-1 ${Number(c.saldo_atual) >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(Number(c.saldo_atual || 0))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </ModulePage>

      {/* ── Lançamento manual modal ── */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançamento Manual" size="md">
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-warning text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Lançamento manual</strong> — intervenção direta no fluxo de caixa. Certifique-se de que o registro é necessário e os valores estão corretos antes de salvar.
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">A Receber (entrada)</SelectItem>
                  <SelectItem value="pagar">A Pagar (saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status <span className="text-destructive">*</span></Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto (a vencer)</SelectItem>
                  <SelectItem value="pago">Pago / Baixado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição <span className="text-destructive">*</span></Label>
            <Input
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Pagamento de fornecedor, recebimento de cliente..."
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="0.01" step="0.01"
                value={form.valor || ""}
                onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento || "__none__"} onValueChange={v => setForm({ ...form, forma_pagamento: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não informado</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Bancária{form.status === "pago" && <span className="text-destructive"> *</span>}</Label>
              <Select value={form.conta_bancaria_id || "__none__"} onValueChange={v => setForm({ ...form, conta_bancaria_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não vinculado</SelectItem>
                  {contasBancarias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.bancos?.nome} — {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o lançamento..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Registrar Lançamento
            </Button>
          </div>
        </form>
      </FormModal>

      {/* ── CSV Import modal ── */}
      <FormModal open={csvOpen} onClose={() => { setCsvOpen(false); setCsvRows([]); setCsvFile(""); }} title="Importar Lançamentos via CSV" size="lg">
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><FileDown className="w-3.5 h-3.5" /> Formato esperado (separado por ponto-e-vírgula)</p>
            <p className="font-mono">data;descricao;valor;tipo</p>
            <p className="text-muted-foreground">Exemplo: <span className="font-mono">2024-01-15;Venda produto X;1500.00;receber</span></p>
            <p className="text-muted-foreground">O campo <strong>tipo</strong> deve ser <strong>receber</strong> ou <strong>pagar</strong>. Todos os lançamentos serão criados com status <strong>aberto</strong>.</p>
          </div>

          <div>
            <Label className="mb-2 block">Arquivo CSV</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{csvFile || "Clique ou arraste um arquivo .csv"}</p>
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
            </div>
          </div>

          {csvRows.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{csvRows.length} registro(s) detectado(s) — prévia:</p>
              <div className="max-h-48 overflow-y-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>{Object.keys(csvRows[0]).map(h => <th key={h} className="p-2 text-left font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((v, j) => <td key={j} className="p-2">{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 10 && <p className="text-xs text-muted-foreground p-2">... e mais {csvRows.length - 10} registro(s)</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCsvOpen(false); setCsvRows([]); setCsvFile(""); }}>Cancelar</Button>
            <Button disabled={!csvRows.length || csvImporting} onClick={handleCsvImport} className="gap-2">
              {csvImporting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Importar {csvRows.length > 0 ? `${csvRows.length} registro(s)` : ""}
            </Button>
          </div>
        </div>
      </FormModal>
    </AppLayout>
  );
};

export default FluxoCaixa;
