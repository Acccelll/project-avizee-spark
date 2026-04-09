import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SummaryCard } from "@/components/SummaryCard";
import { PeriodFilter, financialPeriods, type Period } from "@/components/dashboard/PeriodFilter";
import { periodToFinancialRange } from "@/lib/periodFilter";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DollarSign, Clock, AlertTriangle, CheckCircle, CalendarClock, Download, List, CalendarDays, CreditCard } from "lucide-react";
import { FinanceiroCalendar } from "@/components/financeiro/FinanceiroCalendar";
import { BaixaParcialDialog } from "@/components/financeiro/BaixaParcialDialog";
import { BaixaLoteModal } from "@/components/financeiro/BaixaLoteModal";
import { FinanceiroDrawer } from "@/components/financeiro/FinanceiroDrawer";
import { getEffectiveStatus, processarEstorno } from "@/services/financeiro.service";
import { statusFinanceiro as statusFinanceiroSchema, statusToOptions } from "@/lib/statusSchema";

interface Lancamento {
  id: string; tipo: string; descricao: string; valor: number;
  data_vencimento: string; data_pagamento: string; status: string;
  forma_pagamento: string; banco: string; cartao: string;
  cliente_id: string; fornecedor_id: string; nota_fiscal_id: string;
  conta_bancaria_id: string; conta_contabil_id: string;
  parcela_numero: number; parcela_total: number;
  documento_pai_id: string; saldo_restante: number | null;
  observacoes: string; ativo: boolean;
  created_at?: string;
  clientes?: { nome_razao_social: string }; fornecedores?: { nome_razao_social: string };
  contas_bancarias?: { descricao: string; bancos?: { nome: string } };
  contas_contabeis?: { codigo: string; descricao: string };
}

interface ContaBancaria {
  id: string; descricao: string; banco_id: string;
  agencia: string; conta: string; titular: string; saldo_atual: number; ativo: boolean;
  bancos?: { nome: string };
}

const emptyForm: Record<string, any> = {
  tipo: "receber", descricao: "", valor: 0, data_vencimento: new Date().toISOString().split("T")[0],
  data_pagamento: "", status: "aberto", forma_pagamento: "", banco: "", cartao: "",
  cliente_id: "", fornecedor_id: "", conta_bancaria_id: "", conta_contabil_id: "", observacoes: "",
  gerar_parcelas: false, num_parcelas: 2, intervalo_dias: 30,
};

const Financeiro = () => {
  const { pushView } = useRelationalNavigation();
  const { data, loading, create, update, remove } = useSupabaseCrud<Lancamento>({
    table: "financeiro_lancamentos",
    select: "*, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_bancarias(descricao, bancos(nome))"
  });
  const clientesCrud = useSupabaseCrud<any>({ table: "clientes" });
  const fornecedoresCrud = useSupabaseCrud<any>({ table: "fornecedores" });

  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contasContabeis, setContasContabeis] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Lancamento | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>(tipoParam ? [tipoParam] : []);
  const [bancoFilters, setBancoFilters] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [baixaLoteOpen, setBaixaLoteOpen] = useState(false);
  const [baixaParcialOpen, setBaixaParcialOpen] = useState(false);
  const [baixaParcialTarget, setBaixaParcialTarget] = useState<Lancamento | null>(null);
  const [estornoTarget, setEstornoTarget] = useState<Lancamento | null>(null);
  const [estornoProcessing, setEstornoProcessing] = useState(false);

  useEffect(() => { if (tipoParam) setTipoFilters([tipoParam]); }, [tipoParam]);

  useEffect(() => {
    const load = async () => {
      const [{ data: contas }, { data: contabeis }] = await Promise.all([
        supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true),
        supabase.from("contas_contabeis").select("id, codigo, descricao").eq("ativo", true).eq("aceita_lancamento", true).order("codigo"),
      ]);
      setContasBancarias(contas || []);
      setContasContabeis(contabeis || []);
    };
    load();
  }, []);

  const openCreate = () => { setMode("create"); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (l: Lancamento) => {
    setMode("edit"); setSelected(l);
    setForm({
      tipo: l.tipo, descricao: l.descricao, valor: l.valor, data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento || "", status: l.status,
      forma_pagamento: l.forma_pagamento || "", banco: l.banco || "", cartao: l.cartao || "",
      cliente_id: l.cliente_id || "", fornecedor_id: l.fornecedor_id || "",
      conta_bancaria_id: l.conta_bancaria_id || "", conta_contabil_id: l.conta_contabil_id || "",
      observacoes: l.observacoes || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || !form.valor) { toast.error("Descrição e valor são obrigatórios"); return; }
    if (form.status === "pago") {
      if (!form.data_pagamento) { toast.error("Data de pagamento é obrigatória para status Pago"); return; }
      if (!form.forma_pagamento) { toast.error("Forma de pagamento é obrigatória para status Pago"); return; }
      if (!form.conta_bancaria_id) { toast.error("Conta bancária é obrigatória para baixa"); return; }
    }
    setSaving(true);
    try {
      const basePayload = {
        tipo: form.tipo, descricao: form.descricao, valor: form.valor,
        data_vencimento: form.data_vencimento, status: form.status,
        forma_pagamento: form.forma_pagamento || null, banco: form.banco || null,
        cartao: form.cartao || null, cliente_id: form.cliente_id || null,
        fornecedor_id: form.fornecedor_id || null, conta_bancaria_id: form.conta_bancaria_id || null,
        conta_contabil_id: form.conta_contabil_id || null, data_pagamento: form.data_pagamento || null,
        observacoes: form.observacoes || null,
      };

      if (mode === "create" && form.gerar_parcelas && form.num_parcelas > 1) {
        const numP = Number(form.num_parcelas);
        const intervalo = Number(form.intervalo_dias) || 30;
        const valorParcela = Number((form.valor / numP).toFixed(2));
        const resto = Number((form.valor - valorParcela * numP).toFixed(2));
        const parentPayload = { ...basePayload, descricao: `${form.descricao} (agrupador)`, parcela_numero: 0, parcela_total: numP };
        const parentResult = await create(parentPayload);
        const parentId = (parentResult as any)?.id;
        for (let i = 0; i < numP; i++) {
          const venc = new Date(form.data_vencimento);
          venc.setDate(venc.getDate() + intervalo * i);
          await create({
            ...basePayload, descricao: `${form.descricao} - ${i + 1}/${numP}`,
            valor: i === numP - 1 ? valorParcela + resto : valorParcela,
            data_vencimento: venc.toISOString().split("T")[0],
            parcela_numero: i + 1, parcela_total: numP, documento_pai_id: parentId || null,
          });
        }
        toast.success(`${numP} parcelas geradas com sucesso!`);
      } else if (mode === "create") {
        await create(basePayload);
      } else if (selected) {
        await update(selected.id, basePayload);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('[financeiro] erro ao salvar:', err);
      toast.error("Erro ao salvar lançamento");
    }
    setSaving(false);
  };

  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const getLancamentoStatus = (l: Lancamento) => getEffectiveStatus(l.status, l.data_vencimento, hoje);

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const { dateFrom, dateTo } = periodToFinancialRange(period);
    const isOverdueFilter = period === "vencidos";

    return data.filter((l) => {
      const effectiveStatus = getLancamentoStatus(l);
      if (period === "todos") { /* no filter */ }
      else if (isOverdueFilter) { if (effectiveStatus !== "vencido") return false; }
      else { if (l.data_vencimento < dateFrom) return false; if (dateTo && l.data_vencimento > dateTo) return false; }
      if (statusFilters.length > 0 && !statusFilters.includes(effectiveStatus)) return false;
      if (tipoFilters.length > 0 && !tipoFilters.includes(l.tipo)) return false;
      if (bancoFilters.length > 0 && !bancoFilters.includes(l.conta_bancaria_id || "")) return false;
      if (query) {
        const haystack = [
          l.descricao, l.clientes?.nome_razao_social, l.fornecedores?.nome_razao_social,
          l.forma_pagamento, l.banco, l.contas_bancarias?.descricao, l.contas_bancarias?.bancos?.nome,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [data, statusFilters, tipoFilters, bancoFilters, searchTerm, hoje, period]);

  const hojeStr = useMemo(() => hoje.toISOString().split("T")[0], [hoje]);

  const kpis = useMemo(() => {
    let aVencer = 0, venceHoje = 0, vencido = 0, pagoNoPeriodo = 0, parcialCount = 0;
    let totalAVencer = 0, totalVencido = 0, totalPago = 0, totalParcial = 0;

    filteredData.forEach(l => {
      const val = Number(l.valor || 0);
      const es = getLancamentoStatus(l);
      if (es === "pago") { pagoNoPeriodo++; totalPago += val; }
      else if (es === "vencido") { vencido++; totalVencido += val; }
      else if (es === "parcial") { parcialCount++; totalParcial += Number(l.saldo_restante ?? val); }
      else if (es === "aberto") {
        if (l.data_vencimento === hojeStr) venceHoje++;
        aVencer++; totalAVencer += val;
      }
    });
    return { aVencer, venceHoje, vencido, pagoNoPeriodo, parcialCount, totalAVencer, totalVencido, totalPago, totalParcial };
  }, [filteredData, hoje, hojeStr]);

  const handleEstorno = async () => {
    if (!estornoTarget) return;
    setEstornoProcessing(true);
    const ok = await processarEstorno(estornoTarget.id);
    setEstornoProcessing(false);
    if (ok) { setEstornoTarget(null); window.location.reload(); }
  };

  const selectedForBaixa = useMemo(() => data.filter(l => selectedIds.includes(l.id)), [data, selectedIds]);

  const columns = [
    {
      key: "tipo",
      mobileCard: true, label: "Tipo", sortable: true,
      render: (l: Lancamento) => (
        <Badge variant="outline" className={l.tipo === "receber" ? "border-success/40 text-success bg-success/5 whitespace-nowrap" : "border-destructive/40 text-destructive bg-destructive/5 whitespace-nowrap"}>
          {l.tipo === "receber" ? "Receber" : "Pagar"}
        </Badge>
      ),
    },
    {
      key: "parceiro",
      mobilePrimary: true, label: "Pessoa", sortable: true,
      render: (l: Lancamento) => {
        const nome = l.tipo === "receber" ? l.clientes?.nome_razao_social : l.fornecedores?.nome_razao_social;
        if (!nome) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-medium text-sm">{nome}</span>;
      },
    },
    {
      key: "descricao",
      mobileCard: true, label: "Descrição", sortable: true,
      render: (l: Lancamento) => (
        <div className="space-y-0.5">
          <span className="text-sm">{l.descricao}</span>
          {l.parcela_numero > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono block">
              Parcela {l.parcela_numero}/{l.parcela_total}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "data_vencimento",
      mobileCard: true, label: "Vencimento", sortable: true,
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        const isOverdue = es === "vencido";
        const isToday = l.data_vencimento === hojeStr;
        const [y, m, d] = l.data_vencimento.split("-").map(Number);
        const venc = new Date(y, m - 1, d);
        const diasAtraso = isOverdue
          ? Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return (
          <div className="space-y-0.5">
            <span className={cn("text-sm", isOverdue ? "text-destructive font-semibold" : isToday ? "text-warning font-semibold" : "")}>
              {venc.toLocaleDateString("pt-BR")}
            </span>
            {isOverdue && diasAtraso > 0 && (
              <span className="text-[10px] text-destructive font-medium block">{diasAtraso}d em atraso</span>
            )}
            {isToday && !isOverdue && (
              <span className="text-[10px] text-warning font-medium block">Vence hoje</span>
            )}
          </div>
        );
      },
    },
    {
      key: "valor",
      mobileCard: true, label: "Valor Total", sortable: true,
      render: (l: Lancamento) => (
        <span className="font-semibold font-mono text-sm">{formatCurrency(Number(l.valor))}</span>
      ),
    },
    {
      key: "saldo_restante", label: "Saldo em Aberto",
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        if (es === "pago" || es === "cancelado") return <span className="text-muted-foreground text-xs">—</span>;
        const saldo = l.saldo_restante != null ? Number(l.saldo_restante) : Number(l.valor);
        if (saldo <= 0) return <span className="text-success text-xs font-mono font-semibold">Quitado</span>;
        return (
          <span className={cn("font-mono text-sm font-semibold", es === "vencido" ? "text-destructive" : es === "parcial" ? "text-warning" : "")}>
            {formatCurrency(saldo)}
          </span>
        );
      },
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (l: Lancamento) => <StatusBadge status={getLancamentoStatus(l)} />,
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
        return <span className="text-xs">{l.contas_bancarias.bancos?.nome} - {l.contas_bancarias.descricao}</span>;
      },
    },
    {
      key: "acoes_rapidas", label: "Ações", sortable: false,
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        const canBaixa = es !== "pago" && es !== "cancelado";
        if (!canBaixa) return null;
        return (
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); setBaixaParcialTarget(l); setBaixaParcialOpen(true); }}
          >
            <CreditCard className="h-3 w-3" /> Baixar
          </Button>
        );
      },
    },
  ];

  const finActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    tipoFilters.forEach(f => chips.push({ key: "tipo", label: "Tipo", value: [f], displayValue: f === "receber" ? "A Receber" : "A Pagar" }));
    statusFilters.forEach(f => chips.push({ key: "status", label: "Status", value: [f], displayValue: f.charAt(0).toUpperCase() + f.slice(1) }));
    bancoFilters.forEach(f => {
      const banco = contasBancarias.find(c => c.id === f);
      chips.push({ key: "banco", label: "Banco", value: [f], displayValue: banco ? `${banco.bancos?.nome} - ${banco.descricao}` : f });
    });
    return chips;
  }, [tipoFilters, statusFilters, bancoFilters, contasBancarias]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "tipo") setTipoFilters(prev => prev.filter(v => v !== value));
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "banco") setBancoFilters(prev => prev.filter(v => v !== value));
  };

  const tipoOpts: MultiSelectOption[] = [{ label: "A Receber", value: "receber" }, { label: "A Pagar", value: "pagar" }];
  const statusOpts: MultiSelectOption[] = statusToOptions(statusFinanceiroSchema);
  const bancoOpts: MultiSelectOption[] = contasBancarias.map(c => ({ label: `${c.bancos?.nome} - ${c.descricao}`, value: c.id }));

  return (
    <AppLayout>
      <ModulePage title="Contas a Pagar/Receber" subtitle="Gestão unificada de contas a pagar e receber" addLabel="Novo Lançamento" onAdd={openCreate}>

        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PeriodFilter value={period} onChange={setPeriod} options={financialPeriods} />
          <div className="flex gap-1 ml-auto rounded-lg border p-0.5">
            <Button size="sm" variant={viewMode === "lista" ? "default" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setViewMode("lista")}>
              <List className="h-3.5 w-3.5" /> Lista
            </Button>
            <Button size="sm" variant={viewMode === "calendario" ? "default" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setViewMode("calendario")}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <SummaryCard title="A Vencer" value={kpis.aVencer.toString()} subtitle={formatCurrency(kpis.totalAVencer)} icon={CalendarClock} variant="info" onClick={() => setStatusFilters(["aberto"])} />
          <SummaryCard title="Vence Hoje" value={kpis.venceHoje.toString()} icon={Clock} variant="warning" />
          <SummaryCard title="Vencidos" value={kpis.vencido.toString()} subtitle={formatCurrency(kpis.totalVencido)} icon={AlertTriangle} variant="danger" onClick={() => setStatusFilters(["vencido"])} />
          <SummaryCard title="Parcialmente Baixados" value={kpis.parcialCount.toString()} subtitle={formatCurrency(kpis.totalParcial)} icon={DollarSign} variant="info" onClick={() => setStatusFilters(["parcial"])} />
          <SummaryCard title="Pagos" value={kpis.pagoNoPeriodo.toString()} subtitle={formatCurrency(kpis.totalPago)} icon={CheckCircle} variant="success" onClick={() => setStatusFilters(["pago"])} />
        </div>

        <AdvancedFilterBar
          searchValue={searchTerm} onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por descrição, pessoa, banco ou forma de pagamento..."
          activeFilters={finActiveFilters} onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setTipoFilters([]); setStatusFilters([]); setBancoFilters([]); }}
          count={filteredData.length}
          extra={selectedIds.length > 0 ? (
            <Button size="sm" variant="default" className="gap-2" onClick={() => {
              if (selectedIds.length === 0) { toast.error("Selecione os lançamentos"); return; }
              setBaixaLoteOpen(true);
            }}>
              <Download className="w-3.5 h-3.5" /> Baixar {selectedIds.length} selecionado(s)
            </Button>
          ) : undefined}
        >
          <MultiSelect options={tipoOpts} selected={tipoFilters} onChange={setTipoFilters} placeholder="Tipo" className="w-[150px]" />
          <MultiSelect options={statusOpts} selected={statusFilters} onChange={setStatusFilters} placeholder="Status" className="w-[180px]" />
          <MultiSelect options={bancoOpts} selected={bancoFilters} onChange={setBancoFilters} placeholder="Bancos" className="w-[200px]" />
        </AdvancedFilterBar>

        {viewMode === "calendario" ? (
          <FinanceiroCalendar data={filteredData as any} />
        ) : (
          <DataTable columns={columns} data={filteredData} loading={loading}
            moduleKey="financeiro-lancamentos" showColumnToggle={true}
            selectable selectedIds={selectedIds} onSelectionChange={setSelectedIds}
            onView={(l) => { setSelected(l); setDrawerOpen(true); }} />
        )}
      </ModulePage>

      {/* Form Modal */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Lançamento" : "Editar Lançamento"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="receber">A Receber</SelectItem><SelectItem value="pagar">A Pagar</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem><SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento || "nenhum"} onValueChange={(v) => setForm({ ...form, forma_pagamento: v === "nenhum" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Selecione...</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem><SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} required /></div>
            <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            <div className="space-y-2"><Label>Data Pagamento</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
            <div className="space-y-2"><Label>Conta Bancária {form.status === "pago" ? "*" : ""}</Label>
              <Select value={form.conta_bancaria_id || "nenhum"} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v === "nenhum" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Selecione...</SelectItem>
                  {contasBancarias.map(c => (<SelectItem key={c.id} value={c.id}>{c.bancos?.nome} - {c.descricao}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Cartão</Label><Input value={form.cartao} onChange={(e) => setForm({ ...form, cartao: e.target.value })} /></div>
            {form.tipo === "receber" && (
              <div className="space-y-2"><Label>Cliente</Label>
                <Select value={form.cliente_id || "nenhum"} onValueChange={(v) => setForm({ ...form, cliente_id: v === "nenhum" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Selecione...</SelectItem>
                    {clientesCrud.data.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome_razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.tipo === "pagar" && (
              <div className="space-y-2"><Label>Fornecedor</Label>
                <Select value={form.fornecedor_id || "nenhum"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "nenhum" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Selecione...</SelectItem>
                    {fornecedoresCrud.data.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome_razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {contasContabeis.length > 0 && (
            <div className="space-y-2">
              <Label>Conta Contábil (opcional)</Label>
              <Select value={form.conta_contabil_id || "none"} onValueChange={(v) => setForm({ ...form, conta_contabil_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Vincular conta contábil..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {contasContabeis.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.descricao}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.status === "pago" && (!form.data_pagamento || !form.forma_pagamento || !form.conta_bancaria_id) && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
              ⚠️ Para confirmar como Pago, preencha Data de Pagamento, Forma de Pagamento e Conta Bancária.
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3 rounded-lg border p-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={form.gerar_parcelas} onChange={(e) => setForm({ ...form, gerar_parcelas: e.target.checked })} className="rounded" />
                Gerar parcelas automaticamente
              </label>
              {form.gerar_parcelas && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs">Nº de Parcelas</Label><Input type="number" min={2} max={48} value={form.num_parcelas} onChange={(e) => setForm({ ...form, num_parcelas: Number(e.target.value) })} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Intervalo (dias)</Label><Input type="number" min={1} max={365} value={form.intervalo_dias} onChange={(e) => setForm({ ...form, intervalo_dias: Number(e.target.value) })} className="h-9" /></div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {form.num_parcelas > 1 && form.valor > 0 && (<span>{form.num_parcelas}× de <strong>{formatCurrency(form.valor / form.num_parcelas)}</strong> a cada {form.intervalo_dias} dias</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

      {/* Detail Drawer */}
      <FinanceiroDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        effectiveStatus={selected ? getLancamentoStatus(selected) : ""}
        onBaixa={(l) => { setBaixaParcialTarget(l); setBaixaParcialOpen(true); }}
        onEstorno={(l) => { setDrawerOpen(false); setEstornoTarget(l); }}
        onEdit={(l) => { setDrawerOpen(false); openEdit(l); }}
        onDelete={(id) => { setDrawerOpen(false); remove(id); }}
      />

      {/* Batch Baixa Modal */}
      <BaixaLoteModal
        open={baixaLoteOpen}
        onClose={() => setBaixaLoteOpen(false)}
        selectedLancamentos={selectedForBaixa}
        contasBancarias={contasBancarias}
        onSuccess={() => { setSelectedIds([]); window.location.reload(); }}
      />

      {/* Estorno Confirm */}
      <ConfirmDialog
        open={!!estornoTarget} onClose={() => setEstornoTarget(null)} onConfirm={handleEstorno}
        title="Confirmar Estorno"
        description={`Deseja estornar a baixa do lançamento "${estornoTarget?.descricao}"? O status voltará para Aberto.`}
        confirmLabel="Estornar" loading={estornoProcessing}
      />

      {/* Single Baixa Parcial */}
      <BaixaParcialDialog
        open={baixaParcialOpen} onClose={() => setBaixaParcialOpen(false)}
        lancamento={baixaParcialTarget} contasBancarias={contasBancarias}
        onSuccess={() => { window.location.reload(); }}
      />
    </AppLayout>
  );
};

export default Financeiro;
