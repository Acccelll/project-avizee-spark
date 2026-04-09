import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Send } from "lucide-react";
import { sendForApproval, approveOrcamento, convertToPedido } from "@/services/orcamentos.service";
import { statusOrcamento } from "@/lib/statusSchema";

interface Orcamento {
  id: string; numero: string; cliente_id: string; data_orcamento: string;
  validade: string; valor_total: number; observacoes: string; status: string;
  quantidade_total: number; peso_total: number;
  pagamento: string; prazo_pagamento: string; prazo_entrega: string;
  ativo: boolean; clientes?: { nome_razao_social: string };
}

const TERMINAL_STATUSES = ["convertido", "cancelado", "rejeitado"];
const PROXIMA_VENCER_DIAS = 7;

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
  const { data, loading, remove, fetchData } = useSupabaseCrud<Orcamento>({ table: "orcamentos", select: "*, clientes(nome_razao_social)" });
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [poNumberCliente, setPoNumberCliente] = useState("");
  const [dataPoCliente, setDataPoCliente] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [clienteFilters, setClienteFilters] = useState<string[]>([]);
  const [validadeFilters, setValidadeFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [clientesList, setClientesList] = useState<any[]>([]);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (!supabase) return;
    supabase.from("clientes").select("id, nome_razao_social").eq("ativo", true).then(({ data }) => setClientesList(data || []));
  }, []);

  const handleSendForApproval = useCallback(async (orc: Orcamento) => {
    try {
      await sendForApproval(orc);
      fetchData();
    } catch {
      toast.error("Erro ao enviar cotação para aprovação.");
    }
  }, [fetchData]);

  const kpis = useMemo(() => {
    const total = data.length;
    const totalValue = data.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const approved = data.filter(o => o.status === "aprovado").length;
    const converted = data.filter(o => o.status === "convertido").length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0";
    return { total, totalValue, approved, conversionRate };
  }, [data]);

  const handleDuplicate = async (orc: Orcamento) => {
    try {
      const { data: items } = await supabase.from("orcamentos_itens").select("*").eq("orcamento_id", orc.id);
      const { count } = await supabase.from("orcamentos").select("*", { count: "exact", head: true });
      const newNumero = `COT${String((count || 0) + 1).padStart(6, "0")}`;
      const { data: newOrc, error } = await supabase.from("orcamentos").insert({
        numero: newNumero, data_orcamento: new Date().toISOString().split("T")[0],
        status: "rascunho", cliente_id: orc.cliente_id, validade: null,
        observacoes: orc.observacoes, desconto: (orc as any).desconto || 0,
        imposto_st: (orc as any).imposto_st || 0, imposto_ipi: (orc as any).imposto_ipi || 0,
        frete_valor: (orc as any).frete_valor || 0, outras_despesas: (orc as any).outras_despesas || 0,
        valor_total: orc.valor_total, quantidade_total: orc.quantidade_total,
        peso_total: orc.peso_total, pagamento: (orc as any).pagamento,
        prazo_pagamento: (orc as any).prazo_pagamento, prazo_entrega: (orc as any).prazo_entrega,
        frete_tipo: (orc as any).frete_tipo, modalidade: (orc as any).modalidade,
        cliente_snapshot: (orc as any).cliente_snapshot,
      }).select().single();
      if (error) throw error;
      if (items && items.length > 0 && newOrc) {
        const newItems = items.map((i: any) => ({
          orcamento_id: newOrc.id, produto_id: i.produto_id,
          codigo_snapshot: i.codigo_snapshot, descricao_snapshot: i.descricao_snapshot,
          variacao: i.variacao, quantidade: i.quantidade, unidade: i.unidade,
          valor_unitario: i.valor_unitario, valor_total: i.valor_total,
          peso_unitario: i.peso_unitario, peso_total: i.peso_total,
        }));
        await supabase.from("orcamentos_itens").insert(newItems);
      }
      toast.success(`Cotação duplicada: ${newNumero}`);
      fetchData();
      navigate(`/cotacoes/${newOrc.id}`);
    } catch (err: any) {
      console.error('[orcamentos] duplicar:', err);
      toast.error("Erro ao duplicar cotação.");
    }
  };

  const handleApprove = async (orc: Orcamento) => {
    if (!isAdmin) {
      toast.error("Somente administradores podem aprovar cotações.");
      return;
    }
    try {
      await approveOrcamento(orc);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao aprovar cotação.");
    }
  };

  const handleConvertToPedido = async (orc: Orcamento) => {
    try {
      await convertToPedido(orc, { poNumber: poNumberCliente, dataPo: dataPoCliente });
      setPoNumberCliente("");
      setDataPoCliente("");
      fetchData();
      navigate(`/pedidos`);
    } catch (err: any) {
      toast.error("Erro ao converter cotação em pedido.");
    } finally {
      setConvertingId(null);
    }
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((orc) => {
      if (statusFilters.length > 0 && !statusFilters.includes(orc.status)) return false;
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
        const effectiveStatus = vs === "vencida" && o.status === "enviado" ? "expirado" : o.status;
        return <StatusBadge status={effectiveStatus} label={statusLabels[effectiveStatus] ?? statusLabels[o.status]} />;
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
          {o.status === "rascunho" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleSendForApproval(o); }}>
              <Send className="w-3 h-3" /> Enviar
            </Button>
          )}
          {o.status === "confirmado" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleApprove(o); }} disabled={!isAdmin} title={!isAdmin ? "Somente admins podem aprovar" : ""}>
              <CheckCircle className="w-3 h-3" /> Aprovar
            </Button>
          )}
          {o.status === "aprovado" && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setConvertingId(o.id); }}>
              <ArrowRightCircle className="w-3 h-3" /> Gerar Pedido
            </Button>
          )}
        </div>
      ),
    },
  ];

  const convertingOrc = data.find(o => o.id === convertingId);

  const validadeOptions: MultiSelectOption[] = [
    { label: "Vencidas", value: "vencida" },
    { label: `Próximas a vencer (≤${PROXIMA_VENCER_DIAS}d)`, value: "proxima" },
    { label: "Vigentes", value: "vigente" },
  ];

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
    <AppLayout>
      <ModulePage
        title="Cotações"
        subtitle="Central de consulta e acompanhamento do funil comercial"
        addLabel="Nova Cotação"
        onAdd={() => navigate("/cotacoes/novo")}
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
          onClearAll={() => { setStatusFilters([]); setClienteFilters([]); setValidadeFilters([]); setDataInicio(""); setDataFim(""); }}
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
          onEdit={(o) => navigate(`/cotacoes/${o.id}`)}
        />
      </ModulePage>

      <ConfirmDialog
        open={!!convertingId}
        onClose={() => {
          setConvertingId(null);
          setPoNumberCliente("");
          setDataPoCliente("");
        }}
        onConfirm={() => convertingOrc && handleConvertToPedido(convertingOrc)}
        title="Gerar Pedido"
        description={`Deseja converter a cotação ${convertingOrc?.numero} em um Pedido? Isso irá marcar a cotação como convertida.`}
        confirmLabel="Gerar Pedido"
        confirmVariant="default"
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
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
      </ConfirmDialog>
    </AppLayout>
  );
};

export default Orcamentos;
