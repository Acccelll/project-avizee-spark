
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { QueryErrorFallback } from "@/components/ui/QueryErrorFallback";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, FileText, DollarSign, Clock, BarChart3, AlertTriangle, Eye, Pencil, PackageCheck } from "lucide-react";
import { MobileQuickAddFAB } from "@/components/MobileQuickAddFAB";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, type PeriodValue } from "@/components/filters/PeriodFilter";
import { periodToDateFrom, periodToDateTo } from "@/lib/periodFilter";
import type { Period } from "@/components/filters/periodTypes";
import { toast } from "sonner";
import { formatCurrency, formatDate, calculateDaysBetween } from "@/lib/format";
import { formatCurrencyCompact } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { Send, Link2 } from "lucide-react";
import { sendForApproval, duplicateOrcamento } from "@/services/orcamentos.service";
import { VincularNfDialog } from "@/components/orcamentos/VincularNfDialog";
import { RegistrarPedidoDialog } from "@/components/orcamentos/RegistrarPedidoDialog";
import { statusOrcamento } from "@/lib/statusSchema";
import { canRegistrarPedido, canSendOrcamento, getOrcamentoStatusLabel, normalizeOrcamentoStatus } from "@/lib/comercialWorkflow";
import { notifyError } from "@/utils/errorMessages";
import { useClientesRef } from "@/hooks/useReferenceCache";
import { useActionLock } from "@/hooks/useActionLock";
import { useUrlListState } from "@/hooks/useUrlListState";
import { subscribeComercial } from "@/lib/realtime/comercialChannel";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import { logger } from "@/lib/logger";

interface Orcamento {
  id: string;
  numero: string;
  cliente_id: string | null;
  data_orcamento: string | null;
  validade: string | null;
  valor_total: number | null;
  observacoes: string | null;
  status: string;
  origem?: string | null;
  quantidade_total: number | null;
  peso_total: number | null;
  pagamento: string | null;
  prazo_pagamento: string | null;
  prazo_entrega: string | null;
  ativo: boolean;
  // Additional fields present in DB
  frete_valor?: number | null;
  frete_tipo?: string | null;
  modalidade?: string | null;
  cliente_snapshot?: unknown;
  prazo_entrega_dias?: number | null;
  pedido_cliente?: string | null;
  data_pedido_cliente?: string | null;
  previsao_despacho?: string | null;
  pedido_registrado_em?: string | null;
  clientes?: { nome_razao_social: string; cpf_cnpj?: string | null } | null;
}

/** Abas rápidas da lista: cada uma é um conjunto de status. */
const ABAS: { value: string; label: string; status: string[] }[] = [
  { value: "todos", label: "Todos", status: [] },
  { value: "negociacao", label: "Em negociação", status: ["rascunho", "pendente"] },
  { value: "pedidos", label: "Pedidos em aberto", status: ["aprovado"] },
  { value: "encerrados", label: "Encerrados", status: ["rejeitado", "cancelado", "expirado"] },
];

function PrevisaoDespacho({ o }: { o: Orcamento }) {
  if (!o.previsao_despacho) return <span className="text-xs text-muted-foreground">—</span>;
  const atrasado =
    normalizeOrcamentoStatus(o.status) === "aprovado" &&
    o.previsao_despacho < new Date().toISOString().slice(0, 10);
  return (
    <span className={atrasado ? "text-xs font-medium text-destructive" : "text-xs"} title={atrasado ? "Previsão de despacho vencida" : undefined}>
      {formatDate(o.previsao_despacho)}
    </span>
  );
}

// Pedido (aprovado) não vence: a validade só vale para a proposta.
const TERMINAL_STATUSES = ["aprovado", "convertido", "cancelado", "rejeitado", "expirado"];
const PROXIMA_VENCER_DIAS = 7;

const historicoOptions: { label: string; value: string }[] = [
  { label: "Todos", value: "todos" },
  { label: "Excluir legados", value: "excluir" },
  { label: "Apenas legados", value: "apenas" },
];

const validadeOptions: { label: string; value: string }[] = [
  { label: "Vencidas", value: "vencida" },
  { label: `Próximas a vencer (≤${PROXIMA_VENCER_DIAS}d)`, value: "proxima" },
  { label: "Vigentes", value: "vigente" },
];

function getValidadeStatus(validade: string | null, status: string): "vencida" | "proxima" | "vigente" | "sem_validade" {
  if (!validade) return "sem_validade";
  if (TERMINAL_STATUSES.includes(status)) return "vigente";
  const daysLeft = calculateDaysBetween(new Date(), validade);
  if (daysLeft < 0) return "vencida";
  if (daysLeft <= PROXIMA_VENCER_DIAS) return "proxima";
  return "vigente";
}

function ValidadeBadge({ validade, status, origem }: { validade: string | null; status: string; origem?: string | null }) {
  if (!validade) {
    const isLegado = origem === "importacao_historica" || status === "historico";
    return (
      <span className="text-xs text-muted-foreground italic">
        {isLegado ? "Legado sem validade" : "Sem validade"}
      </span>
    );
  }
  const vs = getValidadeStatus(validade, status);
  const daysLeft = calculateDaysBetween(new Date(), validade);
  if (vs === "vencida") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-destructive font-medium">{formatDate(validade)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />Vencida
        </Badge>
      </span>
    );
  }
  if (vs === "proxima") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-warning font-medium">{formatDate(validade)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-warning/10 text-warning border-warning/30 gap-1">
          <Clock className="h-2.5 w-2.5" />{daysLeft}d restantes
        </Badge>
      </span>
    );
  }
  return <span className="text-xs">{formatDate(validade)}</span>;
}

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusOrcamento).map(([k, v]) => [k, v.label])
);

const Orcamentos = () => {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();
  const isMobile = useIsMobile();
  const { data: rawData, loading, fetchData, isError, error: queryError } = useSupabaseCrud({ table: "orcamentos", select: "*, clientes(nome_razao_social, cpf_cnpj)" });
  const data = rawData as unknown as Orcamento[];
  const [registrarPedidoId, setRegistrarPedidoId] = useState<string | null>(null);
  const [vincularNfId, setVincularNfId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Realtime: invalida grid quando orçamentos mudam (aprovação/conversão em
  // outras abas, RPCs ou triggers) — mantém a lista sincronizada sem refresh.
  // F-06: também invalida `faturamentoPedido` para que confirmação de NF em
  // outra aba reflita o status `convertido` do orçamento.
  useEffect(() => {
    return subscribeComercial(() => {
      const keys = new Set<string>([
        ...INVALIDATION_KEYS.conversaoOrcamento,
        ...INVALIDATION_KEYS.faturamentoPedido,
      ]);
      keys.forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
      fetchData();
    });
  }, [qc, fetchData]);

  // Querystring CSV unificada com Pedidos/Financeiro (compatível com `buildDrilldownUrl`).
  const { value: filterState, set: setFilters } = useUrlListState({
    schema: {
      q: { type: "string" },
      status: { type: "stringArray" },
      cliente: { type: "stringArray" },
      validade: { type: "stringArray" },
      de: { type: "string" },
      ate: { type: "string" },
      historico: { type: "string" },
      aba: { type: "string" },
    },
  });
  const searchTerm = filterState.q;
  const statusFilters = filterState.status;
  const clienteFilters = filterState.cliente;
  const validadeFilters = filterState.validade;
  const dataInicio = filterState.de;
  const dataFim = filterState.ate;
  const historicoFilter = filterState.historico || "todos";
  const aba = ABAS.find((a) => a.value === filterState.aba) ?? ABAS[0];

  const setSearchTerm = (v: string) => setFilters({ q: v });
  const setStatusFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(statusFilters) : fn;
    setFilters({ status: next });
  };
  const setClienteFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(clienteFilters) : fn;
    setFilters({ cliente: next });
  };
  const setValidadeFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(validadeFilters) : fn;
    setFilters({ validade: next });
  };
  const setDataInicio = (v: string) => setFilters({ de: v });
  const setDataFim = (v: string) => setFilters({ ate: v });

  const periodValue: PeriodValue = { preset: null, from: dataInicio || null, to: dataFim || null };
  const handlePeriodChange = (next: PeriodValue) => {
    if (next.preset) {
      const from = periodToDateFrom(next.preset as Period);
      const to = periodToDateTo(next.preset as Period) ?? new Date().toISOString().slice(0, 10);
      setFilters({ de: from, ate: to });
      return;
    }
    setFilters({ de: next.from || "", ate: next.to || "" });
  };
  const setHistoricoFilter = (v: string) => setFilters({ historico: v === "todos" ? "" : v });
  const { data: clientesList = [] } = useClientesRef();
  const sendLock = useActionLock();

  const handleSendForApproval = useCallback(async (orc: Orcamento) => {
    await sendLock.run(async () => {
      try {
        await sendForApproval(orc);
        fetchData();
      } catch (err: unknown) {
        notifyError(err);
      }
    });
  }, [fetchData, sendLock]);

  const handleDuplicate = async (orc: Orcamento) => {
    try {
      const created = await duplicateOrcamento(orc);
      toast.success(`Orçamento duplicado: ${created.numero}`);
      fetchData();
      navigate(`/orcamentos/${created.id}`);
    } catch (err: unknown) {
      logger.error('[orcamentos] duplicar:', err);
      notifyError(err);
    }
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((orc) => {
      const isHistorico = orc.origem === "importacao_historica" || orc.status === "historico";
      if (historicoFilter === "excluir" && isHistorico) return false;
      if (historicoFilter === "apenas" && !isHistorico) return false;
      const normalizedStatus = normalizeOrcamentoStatus(orc.status);
      if (aba.status.length > 0 && !aba.status.includes(normalizedStatus)) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(normalizedStatus)) return false;
      if (clienteFilters.length > 0 && !clienteFilters.includes(orc.cliente_id || "")) return false;

      if (validadeFilters.length > 0) {
        const vs = getValidadeStatus(orc.validade, orc.status);
        if (!validadeFilters.includes(vs)) return false;
      }

      if (dataInicio) {
        const emissao = orc.data_orcamento;
        if (!emissao || emissao < dataInicio) return false;
      }
      if (dataFim) {
        const emissao = orc.data_orcamento;
        if (!emissao || emissao > dataFim) return false;
      }

      if (!query) return true;
      return [orc.numero, orc.clientes?.nome_razao_social, orc.pedido_cliente, orc.observacoes].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, searchTerm, aba, statusFilters, clienteFilters, validadeFilters, dataInicio, dataFim, historicoFilter]);

  const kpis = useMemo(() => {
    const total = filteredData.length;
    const totalValue = filteredData.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const pedidos = filteredData.filter(o => o.status === "aprovado");
    const pedidosValor = pedidos.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const converted = filteredData.filter(o => o.status === "aprovado" || o.status === "convertido").length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0";
    return { total, totalValue, pedidos: pedidos.length, pedidosValor, converted, conversionRate };
  }, [filteredData]);

  const columns = [
    {
      key: "numero",
      mobileCard: true, label: "Nº Orçamento", sortable: true,
      render: (o: Orcamento) => <span className="font-mono text-xs font-semibold text-primary">{o.numero}</span>,
    },
    {
      key: "cliente",
      mobilePrimary: true, label: "Cliente",
      render: (o: Orcamento) => (
        <span className="font-medium text-sm">{o.clientes?.nome_razao_social || "—"}</span>
      ),
    },
    {
      key: "pedido_cliente", label: "Pedido do cliente", sortable: true,
      sortValue: (o: Orcamento) => o.pedido_cliente ?? "",
      render: (o: Orcamento) =>
        o.pedido_cliente ? (
          <span className={o.pedido_cliente === o.numero ? "font-mono text-xs text-muted-foreground" : "font-mono text-xs"}>
            {o.pedido_cliente}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "data_orcamento", label: "Emissão", sortable: true,
      render: (o: Orcamento) => <span className="text-xs">{formatDate(o.data_orcamento)}</span>,
    },
    {
      key: "validade", mobileCard: true, label: "Validade", sortable: true,
      sortValue: (o: Orcamento) => o.validade ?? "",
      render: (o: Orcamento) => <ValidadeBadge validade={o.validade} status={o.status} origem={o.origem} />,
    },
    {
      key: "previsao_despacho", label: "Previsão", sortable: true,
      sortValue: (o: Orcamento) => o.previsao_despacho ?? "",
      render: (o: Orcamento) => <PrevisaoDespacho o={o} />,
    },
    {
      key: "valor_total",
      mobileCard: true, label: "Total", sortable: true,
      render: (o: Orcamento) => <span className="font-semibold font-mono text-sm">{formatCurrency(Number(o.valor_total || 0))}</span>,
    },
    {
      key: "status",
      mobileCard: true, label: "Status", sortable: true,
      render: (o: Orcamento) => {
        const vs = getValidadeStatus(o.validade, o.status);
        const normalizedStatus = normalizeOrcamentoStatus(o.status);
        // C-02: orçamento "pendente" com validade vencida deve aparecer como "expirado"
        // (status canônico após Fase 3.2 — antes era "enviado", removido).
        const effectiveStatus =
          vs === "vencida" && normalizedStatus === "pendente" ? "expirado" : normalizedStatus;
        const badge = (
          <StatusBadge
            status={effectiveStatus}
            label={effectiveStatus === "historico" ? "Legado" : (statusLabels[effectiveStatus] ?? getOrcamentoStatusLabel(o.status))}
          />
        );
        if (effectiveStatus === "historico") {
          return (
            <span title="Orçamento legado importado, sem fluxo comercial ativo." className="inline-block">
              {badge}
            </span>
          );
        }
        return badge;
      },
    },
    {
      key: "pagamento", label: "Pagamento", hidden: true,
      render: (o: Orcamento) => {
        const parts = [o.pagamento, o.prazo_pagamento].filter(Boolean);
        return <span className="text-xs text-muted-foreground">{parts.length > 0 ? parts.join(" · ") : "—"}</span>;
      },
    },
    {
      key: "prazo_entrega", label: "Prazo Entrega", hidden: true,
      render: (o: Orcamento) => <span className="text-xs text-muted-foreground">{o.prazo_entrega || "—"}</span>,
    },
    {
      key: "peso_total", label: "Peso Total", hidden: true,
      render: (o: Orcamento) => <span className="text-xs text-muted-foreground">{o.peso_total ? `${o.peso_total} kg` : "—"}</span>,
    },
  ];

  const registrarPedidoOrc = data.find(o => o.id === registrarPedidoId);

  const orcActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach(f => {
      chips.push({ key: "status", label: "Status", value: [f], displayValue: statusLabels[f] || f });
    });
    clienteFilters.forEach(f => {
      const cli = clientesList.find(x => x.id === f);
      chips.push({ key: "cliente", label: "Cliente", value: [f], displayValue: cli?.nome_razao_social || f });
    });
    validadeFilters.forEach(f => {
      const opt = validadeOptions.find(x => x.value === f);
      chips.push({ key: "validade", label: "Validade", value: [f], displayValue: opt?.label || f });
    });
    if (dataInicio) chips.push({ key: "dataInicio", label: "Emissão desde", value: [dataInicio], displayValue: formatDate(dataInicio) });
    if (dataFim) chips.push({ key: "dataFim", label: "Emissão até", value: [dataFim], displayValue: formatDate(dataFim) });
    if (historicoFilter && historicoFilter !== "todos") {
      const opt = historicoOptions.find(x => x.value === historicoFilter);
      chips.push({ key: "historico", label: "Legados", value: [historicoFilter], displayValue: opt?.label || historicoFilter });
    }
    return chips;
  }, [statusFilters, clienteFilters, validadeFilters, dataInicio, dataFim, historicoFilter, clientesList]);

  const handleRemoveOrcFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "cliente") setClienteFilters(prev => prev.filter(v => v !== value));
    if (key === "validade") setValidadeFilters(prev => prev.filter(v => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
    if (key === "historico") setHistoricoFilter("todos");
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(([k, v]) => ({
    label: v, value: k
  }));

  const clienteOptions: MultiSelectOption[] = clientesList.map(c => ({
    label: c.nome_razao_social, value: c.id
  }));

  return (
    <><ModulePage
        title="Orçamentos"
        subtitle="Central de consulta e acompanhamento do funil comercial"
        addLabel="Novo Orçamento"
        onAdd={() => navigate("/orcamentos/novo")}
        addButtonHelpId="orcamentos.novoBtn"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Total de Orçamentos" shortTitle="Orçamentos" value={String(kpis.total)} icon={FileText} variationType="neutral" variation="no período filtrado" />
          <SummaryCard title="Valor Total" shortTitle="Valor total" value={isMobile ? formatCurrencyCompact(kpis.totalValue) : formatCurrency(kpis.totalValue)} icon={DollarSign} variationType="neutral" variation="soma do filtro atual" />
          <SummaryCard title="Pedidos em aberto" shortTitle="Pedidos" value={String(kpis.pedidos)} icon={PackageCheck} variationType="positive" variation={formatCurrency(kpis.pedidosValor)} />
          <div title="Orçamentos que viraram pedido ÷ total de orçamentos no filtro">
            <SummaryCard
              title="Viraram pedido"
              shortTitle="Viraram pedido"
              value={`${kpis.conversionRate}%`}
              icon={BarChart3}
              variationType="positive"
              variation={`${kpis.converted} de ${kpis.total}`}
            />
          </div>
        </div>

        <div role="tablist" aria-label="Situação" className="mb-3 flex flex-wrap gap-1.5">
          {ABAS.map((a) => (
            <Button
              key={a.value}
              role="tab"
              aria-selected={aba.value === a.value}
              size="sm"
              variant={aba.value === a.value ? "default" : "outline"}
              className="h-9"
              onClick={() => setFilters({ aba: a.value === "todos" ? "" : a.value })}
            >
              {a.label}
            </Button>
          ))}
        </div>

        <div data-help-id="orcamentos.filtros">
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por orçamento, cliente ou pedido do cliente..."
          activeFilters={orcActiveFilters}
          onRemoveFilter={handleRemoveOrcFilter}
          onClearAll={() => { setStatusFilters([]); setClienteFilters([]); setValidadeFilters([]); setDataInicio(""); setDataFim(""); setSearchTerm(""); }}
          count={filteredData.length}
        >
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-wrap gap-2 items-center">
              <MultiSelect
                options={statusOptions}
                selected={statusFilters}
                onChange={setStatusFilters}
                placeholder="Status do orçamento"
                className="w-[220px]"
              />
              <MultiSelect
                options={clienteOptions}
                selected={clienteFilters}
                onChange={setClienteFilters}
                placeholder="Clientes"
                className="w-[250px]"
              />
              <PeriodFilter mode="both" value={periodValue} onChange={handlePeriodChange} direction="past" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <MultiSelect
                options={validadeOptions}
                selected={validadeFilters}
                onChange={setValidadeFilters}
                placeholder="Validade"
                className="w-[200px]"
              />
              <Select value={historicoFilter} onValueChange={setHistoricoFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Legados" />
                </SelectTrigger>
                <SelectContent>
                  {historicoOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      Legados: {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdvancedFilterBar>
        </div>

        <PullToRefresh onRefresh={fetchData}>
          <div data-help-id="orcamentos.tabela">
          {isError ? (
            <QueryErrorFallback error={queryError} onRetry={fetchData} />
          ) : (
          <DataTable
            columns={columns}
            data={filteredData}
            loading={loading}
            moduleKey="cotacoes"
            showColumnToggle={true}
            onView={(o) => pushView("orcamento", o.id)}
            onEdit={(o) => navigate(`/orcamentos/${o.id}`)}
            rowExtraActions={(o: Orcamento) => (
              <>
                {canSendOrcamento(o.status) && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={sendLock.pending} onClick={(e) => { e.stopPropagation(); handleSendForApproval(o); }} title="Marcar como enviado ao cliente" aria-label="Marcar como enviado ao cliente">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
                {canRegistrarPedido(o.status, o.pedido_registrado_em) && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" onClick={(e) => { e.stopPropagation(); setRegistrarPedidoId(o.id); }} title="Registrar pedido do cliente" aria-label="Registrar pedido do cliente">
                    <ClipboardCheck className="h-4 w-4" />
                  </Button>
                )}
                {["aprovado", "convertido"].includes(normalizeOrcamentoStatus(o.status)) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); setVincularNfId(o.id); }}
                    title="Vincular este orçamento a uma NF de saída já emitida"
                    aria-label="Vincular NF"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            mobileStatusKey="status"
            mobileIdentifierKey="numero"
            mobileInlineActions={(o) => (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 p-0"
                  onClick={(e) => { e.stopPropagation(); pushView("orcamento", o.id); }}
                  aria-label="Ver detalhes"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {normalizeOrcamentoStatus(o.status) !== "historico" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 p-0"
                    onClick={(e) => { e.stopPropagation(); navigate(`/orcamentos/${o.id}`); }}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            mobilePrimaryAction={(o) => {
              if (canRegistrarPedido(o.status, o.pedido_registrado_em)) {
                return (
                  <Button
                    size="lg"
                    variant="default"
                    className="h-11 w-full gap-2 text-sm"
                    onClick={(e) => { e.stopPropagation(); setRegistrarPedidoId(o.id); }}
                  >
                    <ClipboardCheck className="w-4 h-4" /> Registrar pedido
                  </Button>
                );
              }
              const ns = normalizeOrcamentoStatus(o.status);
              if (ns === "convertido") {
                return (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 w-full gap-2 text-sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/pedidos?cotacao=${o.id}`); }}
                  >
                    <Eye className="w-4 h-4" /> Abrir pedido (OV)
                  </Button>
                );
              }
              if (ns === "historico") {
                return (
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-11 w-full gap-2 text-sm"
                    onClick={(e) => { e.stopPropagation(); pushView("orcamento", o.id); }}
                  >
                    <Eye className="w-4 h-4" /> Visualizar
                  </Button>
                );
              }
              return null;
            }}
            emptyTitle="Nenhum orçamento encontrado"
            emptyDescription="Crie um novo orçamento ou ajuste os filtros aplicados."
          />
          )}
          </div>
        </PullToRefresh>
      </ModulePage>

      <MobileQuickAddFAB
        onClick={() => navigate('/orcamentos/novo')}
        label="Novo orçamento"
      />

      <RegistrarPedidoDialog
        open={!!registrarPedidoOrc}
        onClose={() => setRegistrarPedidoId(null)}
        orcamento={registrarPedidoOrc ? {
          id: registrarPedidoOrc.id,
          numero: registrarPedidoOrc.numero,
          cliente_id: registrarPedidoOrc.cliente_id,
          clienteNome: registrarPedidoOrc.clientes?.nome_razao_social,
          clienteCpfCnpj: registrarPedidoOrc.clientes?.cpf_cnpj,
          valor_total: registrarPedidoOrc.valor_total,
          prazo_entrega_dias: registrarPedidoOrc.prazo_entrega_dias,
        } : null}
        onDone={() => {
          fetchData();
          if (aba.status.length > 0 && !aba.status.includes("aprovado")) {
            toast.info("O pedido saiu desta aba. Veja em \u201cPedidos em aberto\u201d.", { duration: 5000 });
          }
        }}
      />

      <VincularNfDialog
        open={!!vincularNfId}
        onClose={() => setVincularNfId(null)}
        orcamento={(() => {
          const o = data.find((x) => x.id === vincularNfId);
          return o
            ? { id: o.id, numero: o.numero, cliente_id: o.cliente_id, valor_total: o.valor_total }
            : null;
        })()}
        onLinked={() => {
          fetchData();
        }}
      />
    </>
  );
};

export default Orcamentos;
