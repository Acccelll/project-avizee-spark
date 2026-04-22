
import { useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { Badge } from "@/components/ui/badge";
import { ArrowRightCircle, CheckCircle, FileText, DollarSign, Clock, BarChart3, AlertTriangle } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate, calculateDaysBetween } from "@/lib/format";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Send } from "lucide-react";
import { sendForApproval, approveOrcamento } from "@/services/orcamentos.service";
import { useConverterOrcamento } from "@/pages/comercial/hooks/useConverterOrcamento";
import { useCrossModuleToast } from "@/hooks/useCrossModuleToast";
import { CrossModuleActionDialog, type ImpactItem } from "@/components/CrossModuleActionDialog";
import { statusOrcamento } from "@/lib/statusSchema";
import { canApproveOrcamento, canConvertOrcamento, canSendOrcamento, getOrcamentoStatusLabel, normalizeOrcamentoStatus } from "@/lib/comercialWorkflow";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { useClientesRef } from "@/hooks/useReferenceCache";
import { useActionLock } from "@/hooks/useActionLock";

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
  clientes?: { nome_razao_social: string } | null;
}

const TERMINAL_STATUSES = ["convertido", "cancelado", "rejeitado"];
const PROXIMA_VENCER_DIAS = 7;

const historicoOptions: { label: string; value: string }[] = [
  { label: "Excluir históricos", value: "excluir" },
  { label: "Apenas históricos", value: "apenas" },
  { label: "Todos", value: "todos" },
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

function ValidadeBadge({ validade, status }: { validade: string | null; status: string }) {
  if (!validade) return <span className="text-muted-foreground">—</span>;
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
        <span className="text-xs text-amber-600 font-medium">{formatDate(validade)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200 gap-1">
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
  const { data: rawData, loading, fetchData } = useSupabaseCrud({ table: "orcamentos", select: "*, clientes(nome_razao_social)" });
  const data = rawData as unknown as Orcamento[];
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [poNumberCliente, setPoNumberCliente] = useState("");
  const [dataPoCliente, setDataPoCliente] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  const searchTerm = searchParams.get("q") ?? "";
  const statusFilters = searchParams.getAll("status");
  const clienteFilters = searchParams.getAll("cliente");
  const validadeFilters = searchParams.getAll("validade");
  const dataInicio = searchParams.get("de") ?? "";
  const dataFim = searchParams.get("ate") ?? "";
  const historicoFilter = searchParams.get("historico") ?? "excluir";

  const updateParam = (key: string, value: string | string[] | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      if (Array.isArray(value)) {
        value.forEach((v) => next.append(key, v));
      } else if (value) {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const setSearchTerm = (v: string) => updateParam("q", v || null);
  const setStatusFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(statusFilters) : fn;
    updateParam("status", next);
  };
  const setClienteFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(clienteFilters) : fn;
    updateParam("cliente", next);
  };
  const setValidadeFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(validadeFilters) : fn;
    updateParam("validade", next);
  };
  const setDataInicio = (v: string) => updateParam("de", v || null);
  const setDataFim = (v: string) => updateParam("ate", v || null);
  const setHistoricoFilter = (v: string) => updateParam("historico", v === "excluir" ? null : v);
  const { data: clientesList = [] } = useClientesRef();
  const { isAdmin } = useIsAdmin();
  const sendLock = useActionLock();
  const approveLock = useActionLock();
  const convertLock = useActionLock();
  const converterOrcamento = useConverterOrcamento();
  const crossToast = useCrossModuleToast();

  const handleSendForApproval = useCallback(async (orc: Orcamento) => {
    await sendLock.run(async () => {
      try {
        await sendForApproval(orc);
        fetchData();
      } catch (err: unknown) {
        toast.error(getUserFriendlyError(err));
      }
    });
  }, [fetchData, sendLock]);

  const handleDuplicate = async (orc: Orcamento) => {
    try {
      const { data: items } = await supabase.from("orcamentos_itens").select("*").eq("orcamento_id", orc.id);
      // Buscar metadados completos do orçamento original (frete simulador, etc.)
      const { data: fullOrcamento } = await supabase.from("orcamentos").select("*").eq("id", orc.id).maybeSingle();
      const { data: newNumero } = await supabase.rpc("proximo_numero_orcamento");
      const newNumeroStr = newNumero || `COT${String(Date.now()).slice(-6)}`;
      const fullOrc = (fullOrcamento || {}) as Record<string, unknown>;
      const { data: newOrc, error } = await supabase.from("orcamentos").insert({
        numero: newNumeroStr, data_orcamento: new Date().toISOString().split("T")[0],
        status: "rascunho", cliente_id: orc.cliente_id, validade: null,
        observacoes: orc.observacoes, frete_valor: orc.frete_valor || 0,
        valor_total: orc.valor_total, quantidade_total: orc.quantidade_total,
        peso_total: orc.peso_total, pagamento: orc.pagamento,
        prazo_pagamento: orc.prazo_pagamento, prazo_entrega: orc.prazo_entrega,
        frete_tipo: orc.frete_tipo, modalidade: orc.modalidade,
        cliente_snapshot: orc.cliente_snapshot,
        // Preservar todos os metadados de frete do simulador
        transportadora_id: (fullOrc.transportadora_id as string | null) ?? null,
        frete_simulacao_id: (fullOrc.frete_simulacao_id as string | null) ?? null,
        origem_frete: (fullOrc.origem_frete as string | null) ?? null,
        servico_frete: (fullOrc.servico_frete as string | null) ?? null,
        prazo_entrega_dias: (fullOrc.prazo_entrega_dias as number | null) ?? null,
        volumes: (fullOrc.volumes as number | null) ?? null,
        altura_cm: (fullOrc.altura_cm as number | null) ?? null,
        largura_cm: (fullOrc.largura_cm as number | null) ?? null,
        comprimento_cm: (fullOrc.comprimento_cm as number | null) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase insert type inference limitation
      } as any).select().single();
      if (error) throw error;
      if (items && items.length > 0 && newOrc) {
        const newItems = items.map((i) => ({
          orcamento_id: newOrc.id, produto_id: i.produto_id,
          codigo_snapshot: i.codigo_snapshot, descricao_snapshot: i.descricao_snapshot,
          variacao: i.variacao, quantidade: i.quantidade, unidade: i.unidade,
          valor_unitario: i.valor_unitario, valor_total: i.valor_total,
          peso_unitario: i.peso_unitario, peso_total: i.peso_total,
        }));
        await supabase.from("orcamentos_itens").insert(newItems);
      }
      toast.success(`Cotação duplicada: ${newNumeroStr}`);
      fetchData();
      navigate(`/orcamentos/${newOrc.id}`);
    } catch (err: unknown) {
      console.error('[orcamentos] duplicar:', err);
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleApprove = async (orc: Orcamento) => {
    if (!isAdmin) {
      toast.error("Somente administradores podem aprovar cotações.");
      return;
    }
    await approveLock.run(async () => {
      try {
        await approveOrcamento(orc);
        fetchData();
      } catch (err: unknown) {
        toast.error(getUserFriendlyError(err));
      }
    });
  };

  const handleConvertToPedido = async (orc: Orcamento) => {
    await convertLock.run(async () => {
      try {
        // RPC transacional + invalidação cross-módulo (orcamentos + ordens_venda + pedidos).
        const result = await converterOrcamento.mutateAsync({
          orcamento: orc,
          options: { poNumber: poNumberCliente, dataPo: dataPoCliente },
        });
        setPoNumberCliente("");
        setDataPoCliente("");
        fetchData();
        // Toast com CTA: abre o pedido criado em drawer (sem sair da grid de cotações).
        crossToast.success({
          title: "Pedido gerado!",
          description: `OV ${result.ovNumero} criada a partir da cotação ${orc.numero}.`,
          actionLabel: "Abrir pedido",
          action: { drawer: { type: "ordem_venda", id: result.ovId } },
        });
      } catch {
        // toast já emitido pelo hook
      } finally {
        setConvertingId(null);
      }
    });
  };


  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((orc) => {
      const normalizedStatus = normalizeOrcamentoStatus(orc.status);
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
      return [orc.numero, orc.clientes?.nome_razao_social, orc.observacoes].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, searchTerm, statusFilters, clienteFilters, validadeFilters, dataInicio, dataFim]);

  const kpis = useMemo(() => {
    const total = filteredData.length;
    const totalValue = filteredData.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const approved = filteredData.filter(o => o.status === "aprovado").length;
    const converted = filteredData.filter(o => o.status === "convertido").length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0";
    return { total, totalValue, approved, conversionRate };
  }, [filteredData]);

  const columns = [
    {
      key: "numero",
      mobileCard: true, label: "Nº Cotação", sortable: true,
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
      key: "data_orcamento", label: "Emissão", sortable: true,
      render: (o: Orcamento) => <span className="text-xs">{formatDate(o.data_orcamento)}</span>,
    },
    {
      key: "validade", label: "Validade",
      render: (o: Orcamento) => <ValidadeBadge validade={o.validade} status={o.status} />,
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
        const effectiveStatus = vs === "vencida" && normalizedStatus === "enviado" ? "expirado" : normalizedStatus;
        return <StatusBadge status={effectiveStatus} label={statusLabels[effectiveStatus] ?? getOrcamentoStatusLabel(o.status)} />;
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
    {
      key: "acoes_comercial", label: "Ações", sortable: false,
      render: (o: Orcamento) => (
        <div className="flex items-center gap-1">
          {canSendOrcamento(o.status) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={sendLock.pending} onClick={(e) => { e.stopPropagation(); handleSendForApproval(o); }}>
              <Send className="w-3 h-3" /> Enviar
            </Button>
          )}
          {canApproveOrcamento(o.status) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleApprove(o); }} disabled={!isAdmin || approveLock.pending} title={!isAdmin ? "Somente admins podem aprovar" : ""}>
              <CheckCircle className="w-3 h-3" /> Aprovar
            </Button>
          )}
          {canConvertOrcamento(o.status) && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" disabled={convertLock.pending} onClick={(e) => { e.stopPropagation(); setConvertingId(o.id); }}>
              <ArrowRightCircle className="w-3 h-3" /> Gerar Pedido
            </Button>
          )}
        </div>
      ),
    },
  ];

  const convertingOrc = data.find(o => o.id === convertingId);

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
    return chips;
  }, [statusFilters, clienteFilters, validadeFilters, dataInicio, dataFim, clientesList]);

  const handleRemoveOrcFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "cliente") setClienteFilters(prev => prev.filter(v => v !== value));
    if (key === "validade") setValidadeFilters(prev => prev.filter(v => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(([k, v]) => ({
    label: v, value: k
  }));

  const clienteOptions: MultiSelectOption[] = clientesList.map(c => ({
    label: c.nome_razao_social, value: c.id
  }));

  return (
    <><ModulePage
        title="Cotações"
        subtitle="Central de consulta e acompanhamento do funil comercial"
        addLabel="Nova Cotação"
        onAdd={() => navigate("/orcamentos/novo")}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Total de Cotações" value={String(kpis.total)} icon={FileText} variationType="neutral" variation="registros" />
          <SummaryCard title="Valor Total" value={formatCurrency(kpis.totalValue)} icon={DollarSign} variationType="neutral" variation="acumulado" />
          <SummaryCard title="Aprovadas" value={String(kpis.approved)} icon={CheckCircle} variationType="positive" variation="aguardando geração de pedido" />
          <SummaryCard title="Taxa de Conversão" value={`${kpis.conversionRate}%`} icon={BarChart3} variationType="positive" variation="cotações → Pedido" />
        </div>

        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por número da cotação ou cliente..."
          activeFilters={orcActiveFilters}
          onRemoveFilter={handleRemoveOrcFilter}
          onClearAll={() => { setStatusFilters([]); setClienteFilters([]); setValidadeFilters([]); setDataInicio(""); setDataFim(""); setSearchTerm(""); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            placeholder="Status"
            className="w-[200px]"
          />
          <MultiSelect
            options={validadeOptions}
            selected={validadeFilters}
            onChange={setValidadeFilters}
            placeholder="Validade"
            className="w-[200px]"
          />
          <MultiSelect
            options={clienteOptions}
            selected={clienteFilters}
            onChange={setClienteFilters}
            placeholder="Clientes"
            className="w-[250px]"
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 w-[140px] text-xs"
              title="Emissão desde"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9 w-[140px] text-xs"
              title="Emissão até"
            />
          </div>
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="cotacoes"
          showColumnToggle={true}
          onView={(o) => pushView("orcamento", o.id)}
          onEdit={(o) => navigate(`/orcamentos/${o.id}`)}
          emptyTitle="Nenhuma cotação encontrada"
          emptyDescription="Crie uma nova cotação ou ajuste os filtros aplicados."
        />
      </ModulePage>

      <CrossModuleActionDialog
        open={!!convertingId}
        onClose={() => {
          setConvertingId(null);
          setPoNumberCliente("");
          setDataPoCliente("");
        }}
        onConfirm={() => convertingOrc && handleConvertToPedido(convertingOrc)}
        title="Gerar Pedido"
        description={`Confirma a conversão da cotação ${convertingOrc?.numero} em Pedido?`}
        confirmLabel="Gerar Pedido"
        loading={convertLock.pending}
        impacts={[
          {
            label: "Cria 1 Pedido em /pedidos",
            detail: convertingOrc ? formatCurrency(Number(convertingOrc.valor_total || 0)) : undefined,
            tone: "primary",
          },
          { label: "Cotação muda para “convertido”", tone: "info" },
          { label: "Pedido fica disponível para faturamento", tone: "success" },
        ] satisfies ImpactItem[]}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Nº Pedido do Cliente (PO)</Label>
            <Input
              value={poNumberCliente}
              onChange={(e) => setPoNumberCliente(e.target.value)}
              placeholder="Ex: PO-2026-00123"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Número do pedido de compra emitido pelo cliente.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Data do Pedido do Cliente</Label>
            <Input
              type="date"
              value={dataPoCliente}
              onChange={(e) => setDataPoCliente(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </CrossModuleActionDialog>
    </>
  );
};

export default Orcamentos;
