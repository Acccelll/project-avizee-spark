import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { QueryErrorFallback } from "@/components/ui/QueryErrorFallback";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { FormModal } from "@/components/FormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import { SummaryCard } from "@/components/SummaryCard";
import { PeriodFilter } from "@/components/filters/PeriodFilter";
import { MonthFilter } from "@/components/filters/MonthFilter";
import { financialPeriods } from "@/components/filters/periodTypes";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/utils/errorMessages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  CalendarClock,
  Download,
  List,
  CalendarDays,
  FileDown,
  CreditCard,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { AlertCircle } from "lucide-react";
import { FinanceiroCalendar } from "@/components/financeiro/FinanceiroCalendar";
import { BaixaParcialDialog } from "@/components/financeiro/BaixaParcialDialog";
import { BaixaLoteModal } from "@/components/financeiro/BaixaLoteModal";
import { FinanceiroDrawer } from "@/components/financeiro/FinanceiroDrawer";
import { PendenciasPanel } from "@/components/financeiro/PendenciasPanel";
import { useNotasPendentesForma } from "@/hooks/useNotasPendentesForma";
import { getEffectiveStatus, cancelarLancamento } from "@/services/financeiro.service";
import { statusFinanceiro as statusFinanceiroSchema, statusToOptions } from "@/lib/statusSchema";
import type { Lancamento, Cliente, Fornecedor } from "@/types/domain";
import { useFinanceiroAuxiliares } from "@/pages/financeiro/hooks/useFinanceiroAuxiliares";
import { useFinanceiroFiltros } from "@/pages/financeiro/hooks/useFinanceiroFiltros";
import { useFinanceiroKpisRpc } from "@/pages/financeiro/hooks/useFinanceiroKpisRpc";
import { useFinanceiroActions } from "@/pages/financeiro/hooks/useFinanceiroActions";
import { useFinanceiroLancamentosPaged, useResetPageOnFiltersChange } from "@/pages/financeiro/hooks/useFinanceiroLancamentosPaged";
import { buildFinanceiroColumns } from "@/pages/financeiro/config/financeiroColumns";
import { FinanceiroLancamentoForm } from "@/pages/financeiro/components/FinanceiroLancamentoForm";
import { emptyLancamentoForm, type LancamentoForm } from "@/pages/financeiro/types";
import { ImportarDocumentoIaDialog } from "@/components/financeiro/ImportarDocumentoIaDialog";
import { Sparkles } from "lucide-react";
import { periodToFinancialRange, monthToRange } from "@/lib/periodFilter";
import { normalizeFormaPagamento } from "@/lib/financeiro";
import { displayObservacoes } from "@/lib/displayLancamento";
import { useCanHardDelete } from "@/hooks/useCanHardDelete";
import { PermanentDeleteDialog } from "@/components/PermanentDeleteDialog";
import { Trash2 } from "lucide-react";

const FORMAS_CARTAO = new Set(["cartao_credito", "cartao_debito"]);

const PAGE_SIZE = 50;

const Financeiro = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const autoOpenedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Após uma baixa/estorno, o saldo de `contas_bancarias` pode mudar — invalidar caches relacionados.
  // (Os hooks de baixa/estorno já invalidam ["financeiro","lancamentos"] e ["financeiro","kpis"].)
  const invalidateAfterBaixa = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["financeiro", "lancamentos"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
    queryClient.invalidateQueries({ queryKey: ["ref", "contas_bancarias"] });
  }, [queryClient]);

  const clientesCrud = useSupabaseCrud<Cliente>({ table: "clientes", paginationMode: "all" });
  const fornecedoresCrud = useSupabaseCrud<Fornecedor>({ table: "fornecedores", paginationMode: "all" });

  const { contasBancarias, contasContabeis, cartoes } = useFinanceiroAuxiliares();

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Lancamento | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<LancamentoForm>({ ...emptyLancamentoForm });
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  const { data: notasPendentes = [] } = useNotasPendentesForma();
  const [baixaLoteOpen, setBaixaLoteOpen] = useState(false);
  const [baixaParcialOpen, setBaixaParcialOpen] = useState(false);
  const [baixaParcialTarget, setBaixaParcialTarget] = useState<Lancamento | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Lancamento | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Lancamento | null>(null);
  const { canHardDelete } = useCanHardDelete();
  const [importIaOpen, setImportIaOpen] = useState(false);
  const [iaFields, setIaFields] = useState<Set<keyof LancamentoForm>>(new Set());
  const [bulkCancelMotivo, setBulkCancelMotivo] = useState("");
  const [bulkCancelProcessing, setBulkCancelProcessing] = useState(false);

  // Atalho do Dashboard: `/financeiro?baixa=lote` abre o modal de baixa em lote.
  const baixaAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (baixaAutoOpenedRef.current) return;
    if (searchParams.get("baixa") !== "lote") return;
    baixaAutoOpenedRef.current = true;
    setBaixaLoteOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("baixa");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  // Atalho da Conciliação: `/financeiro?novo=1` abre "Novo Lançamento" já
  // pré-preenchido a partir de `sessionStorage['financeiro:prefill']`.
  const novoAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (novoAutoOpenedRef.current) return;
    if (searchParams.get("novo") !== "1") return;
    novoAutoOpenedRef.current = true;
    let prefill: Partial<LancamentoForm> = {};
    try {
      const raw = sessionStorage.getItem("financeiro:prefill");
      if (raw) prefill = JSON.parse(raw) as Partial<LancamentoForm>;
      sessionStorage.removeItem("financeiro:prefill");
    } catch {
      /* ignore */
    }
    setMode("create");
    setForm({ ...emptyLancamentoForm, ...prefill });
    setIaFields(new Set());
    setModalOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("novo");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const hoje = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const hojeStr = useMemo(() => {
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [hoje]);

  const getLancamentoStatus = useCallback((l: Lancamento) => getEffectiveStatus(l.status, l.data_vencimento, hoje), [hoje]);

  // Deep-link `/financeiro/:id` — busca direta o lançamento pelo ID.
  useEffect(() => {
    if (!paramId || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    (async () => {
      const { data: row, error } = await supabase
        .from("financeiro_lancamentos")
        .select(
          "*, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_bancarias(descricao, bancos(nome)), contas_contabeis(descricao, codigo)",
        )
        .eq("id", paramId)
        .maybeSingle();
      if (!error && row) {
        setSelected(row as Lancamento);
        setDrawerOpen(true);
      }
    })();
  }, [paramId]);

  const {
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    tipoFilters,
    setTipoFilters,
    bancoFilters,
    setBancoFilters,
    origemFilters,
    setOrigemFilters,
    formaPagamentoFilters,
    setFormaPagamentoFilters,
    cartaoFilters,
    setCartaoFilters,
    period,
    setPeriod,
    mes,
    setMes,
    activeFilters,
    handleRemoveFilter,
    tipoOpts,
    bancoOpts,
    origemOpts,
    formaPagamentoOpts,
    cartaoOpts,
  } = useFinanceiroFiltros({ data: [], contasBancarias, cartoes, getLancamentoStatus });

  const statusOpts = statusToOptions(statusFinanceiroSchema);

  // E7.4: Filtros canônicos do servidor (espelhados em RPC de KPIs e listagem).
  const dateRange = useMemo(() => {
    const monthRange = monthToRange(mes);
    if (monthRange) return { from: monthRange.from, to: monthRange.to };
    if (period === "todos") return { from: null as string | null, to: null as string | null };
    if (period === "vencidos") return { from: null as string | null, to: hojeStr };
    const { dateFrom, dateTo } = periodToFinancialRange(period);
    return { from: dateFrom, to: dateTo };
  }, [period, mes, hojeStr]);

  const formasCanonicas = useMemo(
    () => formaPagamentoFilters.map((f) => normalizeFormaPagamento(f) ?? f),
    [formaPagamentoFilters],
  );

  const serverFilters = useMemo(
    () => ({
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      tipos: tipoFilters,
      status: period === "vencidos" ? ["vencido"] : statusFilters,
      bancos: bancoFilters,
      origens: origemFilters,
      formas: formasCanonicas,
      cartoes: cartaoFilters,
      search: searchTerm,
    }),
    [dateRange, tipoFilters, statusFilters, bancoFilters, origemFilters, formasCanonicas, cartaoFilters, searchTerm, period],
  );

  const [page, setPage] = useState(0);
  useResetPageOnFiltersChange(serverFilters, setPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const { data, totalCount, loading, refetch: refetchPaged, isError, error: queryError } = useFinanceiroLancamentosPaged(
    serverFilters,
    page,
    PAGE_SIZE,
    { key: sortKey, dir: sortDir },
  );

  // ── CRUD direto: substitui useSupabaseCrud (que carregava tudo client-side).
  // Mutations simples — invalidam o queryKey global do módulo para refetch.
  const fetchData = useCallback(async () => {
    await refetchPaged();
  }, [refetchPaged]);

  // Remove campos relacionais (joins) que vêm no tipo de domínio mas não
  // pertencem à tabela `financeiro_lancamentos` — evita erro do PostgREST.
  const stripRelations = (payload: Partial<Lancamento>): Record<string, unknown> => {
    const { clientes: _c, fornecedores: _f, contas_bancarias: _cb, contas_contabeis: _cc, ...rest } =
      payload as Record<string, unknown> & { clientes?: unknown; fornecedores?: unknown; contas_bancarias?: unknown; contas_contabeis?: unknown };
    void _c; void _f; void _cb; void _cc;
    return rest;
  };

  const create = useCallback(
    async (payload: Partial<Lancamento>) => {
      const { data: row, error } = await supabase
        .from("financeiro_lancamentos")
        .insert(stripRelations(payload) as never)
        .select()
        .single();
      if (error) {
        notifyError(error);
        throw error;
      }
      await refetchPaged();
      return row as Lancamento;
    },
    [refetchPaged],
  );

  const update = useCallback(
    async (id: string, payload: Partial<Lancamento>) => {
      const { data: row, error } = await supabase
        .from("financeiro_lancamentos")
        .update(stripRelations(payload) as never)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        notifyError(error);
        throw error;
      }
      await refetchPaged();
      return row as Lancamento;
    },
    [refetchPaged],
  );

  const {
    saving,
    handleSubmit,
    handleExportar,
    handleEstorno,
    estornoTarget,
    setEstornoTarget,
    estornoProcessing,
    estornoMotivo,
    setEstornoMotivo,
  } = useFinanceiroActions({ filteredData: data, getLancamentoStatus, create, update, fetchData });

  // KPIs server-side via RPC `kpis_financeiro` — fonte única, sem fallback local.
  const { data: kpisRpc } = useFinanceiroKpisRpc({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    tipos: tipoFilters,
    status: period === "vencidos" ? ["vencido"] : statusFilters,
    bancos: bancoFilters,
    origens: origemFilters,
    formas: formasCanonicas,
    cartoes: cartaoFilters,
    search: searchTerm,
  });

  const kpis = useMemo(
    () => ({
      aVencer: kpisRpc?.a_vencer ?? 0,
      venceHoje: kpisRpc?.vence_hoje ?? 0,
      vencido: kpisRpc?.vencido ?? 0,
      pagoNoPeriodo: kpisRpc?.pago ?? 0,
      parcialCount: kpisRpc?.parcial ?? 0,
      totalAVencer: kpisRpc?.total_a_vencer ?? 0,
      totalVencido: kpisRpc?.total_vencido ?? 0,
      totalPago: kpisRpc?.total_pago ?? 0,
      totalParcial: kpisRpc?.total_parcial ?? 0,
    }),
    [kpisRpc],
  );

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyLancamentoForm });
    setIaFields(new Set());
    setModalOpen(true);
  };

  const openEdit = (l: Lancamento) => {
    setMode("edit");
    setSelected(l);
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento || "",
      status: l.status,
      forma_pagamento: l.forma_pagamento || "",
      banco: l.banco || "",
      cartao: l.cartao || "",
      cartao_id: l.cartao_id || "",
      cartao_fatura_id: l.cartao_fatura_id || "",
      cliente_id: l.cliente_id || "",
      fornecedor_id: l.fornecedor_id || "",
      conta_bancaria_id: l.conta_bancaria_id || "",
      conta_contabil_id: l.conta_contabil_id || "",
      observacoes: displayObservacoes(l.observacoes) ?? "",
      gerar_parcelas: false,
      num_parcelas: 2,
      intervalo_dias: 30,
      forma_pagamento_dados:
        ((l as unknown as { forma_pagamento_dados?: Record<string, unknown> })
          .forma_pagamento_dados as Record<string, unknown>) ?? {},
    });
    setModalOpen(true);
  };

  const selectedForBaixa = useMemo(
    () => data.filter((l) => selectedIds.includes(l.id)),
    [data, selectedIds],
  );

  const showCartaoFilter = useMemo(
    () => cartaoOpts.length > 0 && formaPagamentoFilters.some((f) => FORMAS_CARTAO.has(f)),
    [cartaoOpts.length, formaPagamentoFilters],
  );
  // Limpa cartões selecionados quando o filtro de cartão deixa de ser visível.
  useEffect(() => {
    if (!showCartaoFilter && cartaoFilters.length > 0) {
      setCartaoFilters([]);
    }
  }, [showCartaoFilter, cartaoFilters.length, setCartaoFilters]);

  const bulkCancel = useCallback(async () => {
    if (selectedForBaixa.length === 0) return;
    setBulkCancelProcessing(true);
    const motivo = bulkCancelMotivo.trim();
    const results = await Promise.allSettled(
      selectedForBaixa.map((l) => cancelarLancamento(l.id, motivo)),
    );
    setBulkCancelProcessing(false);
    const ok = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    const fail = results.length - ok;
    if (ok > 0) toast.success(`${ok} lançamento(s) cancelado(s)`);
    if (fail > 0) toast.error(`${fail} falharam — verifique permissões/origem`);
    setBulkCancelOpen(false);
    setBulkCancelMotivo("");
    setSelectedIds([]);
    await fetchData();
  }, [selectedForBaixa, bulkCancelMotivo, setSelectedIds, fetchData]);

  const columns = useMemo(
    () =>
      buildFinanceiroColumns({
        getLancamentoStatus,
        hoje,
        hojeStr,
      }),
    [getLancamentoStatus, hoje, hojeStr],
  );

  return (
    <><ModulePage title="Lançamentos" subtitle="Gestão unificada de contas a pagar e receber" addLabel="Novo Lançamento" onAdd={openCreate} addButtonHelpId="financeiro.novoBtn">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <PeriodFilter
            value={period}
            onChange={(p) => setPeriod(p, { clearMes: true })}
            options={financialPeriods}
            direction="future"
          />
          <MonthFilter value={mes} onChange={setMes} direction="future" />
          <div className="flex gap-1 ml-auto rounded-lg border p-0.5" data-help-id="financeiro.viewToggle">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={viewMode === "lista" ? "default" : "ghost"}
                  className="h-9 sm:h-7 gap-1.5 text-xs min-h-[36px] sm:min-h-0"
                  onClick={() => setViewMode("lista")}
                >
                  <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Lista
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gestão operacional — baixas, edição em lote</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={viewMode === "calendario" ? "default" : "ghost"}
                  className="h-9 sm:h-7 gap-1.5 text-xs min-h-[36px] sm:min-h-0"
                  onClick={() => setViewMode("calendario")}
                >
                  <CalendarDays className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Calendário
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visão por vencimentos no mês</TooltipContent>
            </Tooltip>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 sm:h-7 gap-1.5 text-xs min-h-[36px] sm:min-h-0"
            onClick={() => handleExportar("excel")}
          >
            <FileDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Exportar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 sm:h-7 gap-1.5 text-xs min-h-[36px] sm:min-h-0"
            onClick={() => setImportIaOpen(true)}
            title="Pré-preencher um lançamento a partir de boleto ou nota fiscal (IA)"
          >
            <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Importar (IA)
          </Button>
          <Button
            size="sm"
            variant={pendenciasOpen ? "default" : "outline"}
            className="h-9 sm:h-7 gap-1.5 text-xs min-h-[36px] sm:min-h-0 relative"
            onClick={() => setPendenciasOpen(true)}
          >
            <AlertCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Pendências
            {notasPendentes.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-warning text-warning-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                {notasPendentes.length > 99 ? "99+" : notasPendentes.length}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile: banner "Vence Hoje" tappable acima dos KPIs (filtra para hoje) */}
        {kpis.venceHoje > 0 && (
          <button
            type="button"
            onClick={() => {
              setStatusFilters(["aberto"]);
              setPeriod("hoje");
            }}
            className="md:hidden mb-3 w-full min-h-11 flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm transition-colors active:bg-warning/20"
            aria-label={`Filtrar lançamentos que vencem hoje (${kpis.venceHoje})`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Clock className="h-5 w-5 shrink-0 text-warning" />
              <span className="font-medium text-foreground truncate">
                {kpis.venceHoje} {kpis.venceHoje === 1 ? "título vence hoje" : "títulos vencem hoje"}
              </span>
            </span>
            <span className="text-xs text-muted-foreground shrink-0">Ver →</span>
          </button>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6" data-help-id="financeiro.kpis">
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SummaryCard title="A Vencer" value={kpis.aVencer.toString()} subtitle={formatCurrency(kpis.totalAVencer)} icon={CalendarClock} variant="info" onClick={() => setStatusFilters(["aberto"])} /></div>
            </TooltipTrigger>
            <TooltipContent>Abertos com vencimento futuro no período filtrado</TooltipContent>
          </Tooltip>
          {/* Em mobile, "Vence Hoje" vira banner acima — esconder card duplicado */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:block">
                <SummaryCard
                  title="Vence Hoje"
                  value={kpis.venceHoje.toString()}
                  icon={Clock}
                  variant="warning"
                  onClick={() => {
                    setStatusFilters(["aberto"]);
                    setPeriod("hoje", { clearMes: true });
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>Abertos com vencimento na data de hoje (clique para filtrar)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SummaryCard title="Vencidos" value={kpis.vencido.toString()} subtitle={formatCurrency(kpis.totalVencido)} icon={AlertTriangle} variant="danger" onClick={() => setStatusFilters(["vencido"])} /></div>
            </TooltipTrigger>
            <TooltipContent>Abertos com data de vencimento anterior a hoje</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SummaryCard title="Parcialmente Baixados" value={kpis.parcialCount.toString()} subtitle={formatCurrency(kpis.totalParcial)} icon={DollarSign} variant="info" onClick={() => setStatusFilters(["parcial"])} /></div>
            </TooltipTrigger>
            <TooltipContent>Saldo em aberto com pelo menos uma baixa registrada</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SummaryCard title="Baixados" value={kpis.pagoNoPeriodo.toString()} subtitle={formatCurrency(kpis.totalPago)} icon={CheckCircle} variant="success" onClick={() => setStatusFilters(["pago"])} /></div>
            </TooltipTrigger>
            <TooltipContent>Liquidados no período — inclui pagos (CP) e recebidos (CR)</TooltipContent>
          </Tooltip>
        </div>

        <div data-help-id="financeiro.filtros">
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por descrição, pessoa, banco ou forma de pagamento..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => {
            setTipoFilters([]);
            setStatusFilters([]);
            setBancoFilters([]);
            setOrigemFilters([]);
            setFormaPagamentoFilters([]);
            setCartaoFilters([]);
            // Limpar também o recorte temporal — sem isso, a contagem
            // continuaria limitada a um período "escondido" (ex.: vencidos).
            setPeriod("todos", { clearMes: true });
          }}
          count={totalCount}
          extra={selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="default" className="gap-2" onClick={() => setBaixaLoteOpen(true)}>
                <Download className="w-3.5 h-3.5" /> Baixar {selectedIds.length} selecionado(s)
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => handleExportar("excel", selectedForBaixa)}>
                <FileDown className="w-3.5 h-3.5" /> Exportar selecionados
              </Button>
              <PermissionGate resource="financeiro" action="excluir" mode="hide">
                <Button size="sm" variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => { setBulkCancelMotivo(""); setBulkCancelOpen(true); }}>
                  <X className="w-3.5 h-3.5" /> Cancelar selecionados
                </Button>
              </PermissionGate>
            </div>
          ) : undefined}
        >
          <MultiSelect options={statusOpts} selected={statusFilters} onChange={setStatusFilters} placeholder="Status" className="w-[180px]" />
          <MultiSelect options={tipoOpts} selected={tipoFilters} onChange={setTipoFilters} placeholder="Natureza" className="w-[150px]" />
          <MultiSelect options={bancoOpts} selected={bancoFilters} onChange={setBancoFilters} placeholder="Bancos" className="w-[200px]" />
          <MultiSelect options={formaPagamentoOpts} selected={formaPagamentoFilters} onChange={setFormaPagamentoFilters} placeholder="Forma de pagamento" className="w-[220px]" />
          <MultiSelect options={origemOpts} selected={origemFilters} onChange={setOrigemFilters} placeholder="Origem" className="w-[200px]" />
          {showCartaoFilter && (
            <MultiSelect options={cartaoOpts} selected={cartaoFilters} onChange={setCartaoFilters} placeholder="Cartão" className="w-[200px]" />
          )}
        </AdvancedFilterBar>
        </div>

        {/* Mobile: toggle Lista/Calendário inline (duplica o do header, mais visível) */}
        <div className="md:hidden flex gap-1 mb-3">
          <Button
            size="sm"
            variant={viewMode === "lista" ? "default" : "outline"}
            className="flex-1 h-9 gap-1.5 text-xs"
            onClick={() => setViewMode("lista")}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
          <Button
            size="sm"
            variant={viewMode === "calendario" ? "default" : "outline"}
            className="flex-1 h-9 gap-1.5 text-xs"
            onClick={() => setViewMode("calendario")}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </Button>
        </div>

        {viewMode === "calendario" ? (
          <FinanceiroCalendar
            data={data}
            onBaixaSuccess={invalidateAfterBaixa}
            initialMonth={dateRange.from ? new Date(dateRange.from + "T00:00:00") : undefined}
          />
        ) : (
          <PullToRefresh onRefresh={fetchData}>
            <div data-help-id="financeiro.tabela">
            {isError ? (
              <QueryErrorFallback error={queryError} onRetry={fetchData} />
            ) : (
            <DataTable
              columns={columns}
              data={data}
              loading={loading}
              moduleKey="financeiro-lancamentos"
              showColumnToggle={true}
              selectable
              serverPagination={{
                page,
                setPage,
                totalCount,
                hasMore: (page + 1) * PAGE_SIZE < (totalCount ?? 0),
              }}
              serverSortKey={sortKey}
              serverSortDir={sortDir}
              onServerSort={(k, d) => { setSortKey(k); setSortDir(d); setPage(0); }}
              pageSize={PAGE_SIZE}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              emptyTitle="Nenhum lançamento encontrado"
              emptyDescription="Tente ajustar os filtros ou crie um novo lançamento."
              onView={(l) => {
                setSelected(l);
                setDrawerOpen(true);
              }}
              rowExtraActions={(l) => {
                const es = getLancamentoStatus(l);
                if (es === "pago" || es === "cancelado") return null;
                return (
                  <PermissionGate resource="financeiro" action="baixar" mode="disable">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-primary hover:bg-primary/5 whitespace-nowrap"
                      aria-label={`Baixar lançamento: ${l.descricao}`}
                      title="Baixar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBaixaParcialTarget(l);
                        setBaixaParcialOpen(true);
                      }}
                    >
                      <CreditCard className="h-3 w-3" /> Baixar
                    </Button>
                  </PermissionGate>
                );
              }}
              mobileStatusKey="status"
              mobileIdentifierKey="descricao"
              mobilePrimaryAction={(l) => {
                const es = getLancamentoStatus(l);
                if (es === "pago" || es === "cancelado") return null;
                return (
                  <PermissionGate resource="financeiro" action="baixar" mode="disable">
                    <Button
                      size="sm"
                      className="w-full h-11 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBaixaParcialTarget(l);
                        setBaixaParcialOpen(true);
                      }}
                    >
                      <CreditCard className="h-4 w-4" /> Baixar
                    </Button>
                  </PermissionGate>
                );
              }}
              mobileInlineActions={(l) => (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(l);
                      setDrawerOpen(true);
                    }}
                    aria-label="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(l);
                    }}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            />
            )}
            </div>
          </PullToRefresh>
        )}
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Lançamento" : "Editar Lançamento"} size="lg">
        <FinanceiroLancamentoForm
          form={form}
          mode={mode}
          saving={saving}
          contasBancarias={contasBancarias}
          contasContabeis={contasContabeis}
          clientes={clientesCrud.data}
          fornecedores={fornecedoresCrud.data}
          cartoes={cartoes}
          setForm={setForm}
          onCancel={() => setModalOpen(false)}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(mode, form, selected, () => setModalOpen(false));
          }}
          iaFields={iaFields}
        />
      </FormModal>

      <ImportarDocumentoIaDialog
        open={importIaOpen}
        onClose={() => setImportIaOpen(false)}
        onExtracted={(defaults, ia) => {
          setMode("create");
          setForm({ ...emptyLancamentoForm, ...defaults });
          setIaFields(ia);
          setModalOpen(true);
        }}
      />

      <FinanceiroDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        effectiveStatus={selected ? getLancamentoStatus(selected) : ""}
        onBaixa={(l) => {
          setBaixaParcialTarget(l);
          setBaixaParcialOpen(true);
        }}
        onEstorno={(l) => {
          setDrawerOpen(false);
          setEstornoTarget(l);
        }}
        onEdit={(l) => {
          setDrawerOpen(false);
          openEdit(l);
        }}
        onDelete={async (id, motivo) => {
          const target = data.find((l) => l.id === id) ?? selected;
          setDrawerOpen(false);
          if (!target) return;
          // Se o drawer já coletou o motivo (via useConfirmDestructive),
          // cancela direto — evita pedir o motivo duas vezes. Caso contrário,
          // abre o diálogo padrão que também coleta motivo.
          if (motivo && motivo.trim().length >= 5) {
            const ok = await cancelarLancamento(target.id, motivo.trim());
            if (ok) await fetchData();
          } else {
            setCancelTarget(target);
            setCancelMotivo("");
          }
        }}
      />

      <PendenciasPanel
        open={pendenciasOpen}
        onClose={() => setPendenciasOpen(false)}
      />

      <BaixaLoteModal
        open={baixaLoteOpen}
        onClose={() => setBaixaLoteOpen(false)}
        selectedLancamentos={selectedForBaixa}
        contasBancarias={contasBancarias}
        onSuccess={() => {
          setSelectedIds([]);
          invalidateAfterBaixa();
        }}
      />

      <ConfirmDialog
        open={!!estornoTarget}
        onClose={() => {
          setEstornoTarget(null);
          setEstornoMotivo("");
        }}
        onConfirm={handleEstorno}
        title="Confirmar Estorno"
        description={`Deseja estornar a baixa do lançamento "${estornoTarget?.descricao}"? O status voltará para Aberto.`}
        confirmLabel="Estornar"
        loading={estornoProcessing}
        confirmDisabled={!estornoMotivo.trim()}
      >
        <div className="space-y-2 mt-2">
          <Label className="text-sm font-medium">Motivo do estorno *</Label>
          <Textarea value={estornoMotivo} onChange={(e) => setEstornoMotivo(e.target.value)} placeholder="Informe o motivo do cancelamento da baixa..." rows={3} />
        </div>
      </ConfirmDialog>

      <BaixaParcialDialog
        open={baixaParcialOpen}
        onClose={() => setBaixaParcialOpen(false)}
        lancamento={baixaParcialTarget}
        contasBancarias={contasBancarias}
        cartoes={cartoes}
        onSuccess={() => {
          invalidateAfterBaixa();
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelMotivo("");
        }}
        onConfirm={async () => {
          if (!cancelTarget) return;
          setCancelProcessing(true);
          const ok = await cancelarLancamento(cancelTarget.id, cancelMotivo.trim());
          setCancelProcessing(false);
          if (ok) {
            setCancelTarget(null);
            setCancelMotivo("");
            await fetchData();
          }
        }}
        title="Cancelar Lançamento"
        description={`Deseja cancelar "${cancelTarget?.descricao}"? O título permanecerá no histórico com status Cancelado.`}
        confirmLabel="Cancelar Lançamento"
        loading={cancelProcessing}
        confirmDisabled={cancelMotivo.trim().length < 5}
      >
        <div className="space-y-2 mt-2">
          <Label className="text-sm font-medium">Motivo do cancelamento *</Label>
          <Textarea
            value={cancelMotivo}
            onChange={(e) => setCancelMotivo(e.target.value)}
            placeholder="Mínimo de 5 caracteres. Ex.: duplicidade, divergência com NF, solicitação do cliente..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            A exclusão definitiva não é permitida quando há baixas ou origem fora de “manual”. Use o cancelamento para preservar a trilha de auditoria.
          </p>
          {canHardDelete && cancelTarget && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 space-y-1.5">
              <p className="text-xs text-destructive font-medium">
                Administrador: exclusão definitiva disponível
              </p>
              <p className="text-[11px] text-muted-foreground">
                Remove o lançamento em definitivo do banco (hard delete). Ação
                irreversível e sujeita às regras do servidor (falha se houver
                baixas ativas ou vínculos protegidos).
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 gap-1"
                onClick={() => {
                  const alvo = cancelTarget;
                  setCancelTarget(null);
                  setCancelMotivo("");
                  setHardDeleteTarget(alvo);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir definitivamente
              </Button>
            </div>
          )}
        </div>
      </ConfirmDialog>

      {hardDeleteTarget && (
        <PermanentDeleteDialog
          open={!!hardDeleteTarget}
          onClose={() => setHardDeleteTarget(null)}
          table="financeiro_lancamentos"
          id={hardDeleteTarget.id}
          entityLabel="lançamento"
          recordName={hardDeleteTarget.descricao || hardDeleteTarget.id}
          warning="Esta operação apaga o registro do banco. Baixas, conciliações e vínculos dependentes podem impedir a exclusão."
          onDeleted={async () => {
            setHardDeleteTarget(null);
            await fetchData();
          }}
        />
      )}

      <ConfirmDialog
        open={bulkCancelOpen}
        onClose={() => { setBulkCancelOpen(false); setBulkCancelMotivo(""); }}
        onConfirm={bulkCancel}
        title={`Cancelar ${selectedForBaixa.length} lançamento(s)`}
        description="Os títulos permanecerão no histórico com status Cancelado. Itens com baixas registradas ou origem não-manual podem falhar."
        confirmLabel="Cancelar selecionados"
        loading={bulkCancelProcessing}
        confirmDisabled={bulkCancelMotivo.trim().length < 5}
      >
        <div className="space-y-2 mt-2">
          <Label className="text-sm font-medium">Motivo do cancelamento *</Label>
          <Textarea
            value={bulkCancelMotivo}
            onChange={(e) => setBulkCancelMotivo(e.target.value)}
            placeholder="Mínimo de 5 caracteres. Será aplicado a todos os selecionados."
            rows={3}
          />
        </div>
      </ConfirmDialog>
    </>
  );
};

export default Financeiro;
