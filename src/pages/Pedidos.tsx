import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { FileOutput, AlertTriangle, Clock } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate, daysSince, formatNumber, calculateDaysBetween } from "@/lib/format";
import { calcularStatusFaturamentoOV } from "@/lib/fiscal";
import { FileText, DollarSign, Truck } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Pedido {
  id: string; numero: string; data_emissao: string; cliente_id: string;
  cotacao_id: string; status: string; status_faturamento: string;
  data_aprovacao: string; data_prometida_despacho: string;
  prazo_despacho_dias: number; valor_total: number; observacoes: string;
  po_number: string;
  ativo: boolean;
  clientes?: { nome_razao_social: string };
  orcamentos?: { numero: string };
}

const TERMINAL_STATUSES_PEDIDO = ["entregue", "faturado", "cancelada"];
const PRAZO_ALERTA_DIAS = 3;
const DIAS_ABERTO_ALERTA = 30;

function getPrazoStatus(dataPrazo: string | null, statusOp: string): "atrasado" | "proximo" | "ok" | "sem_prazo" {
  if (!dataPrazo) return "sem_prazo";
  if (TERMINAL_STATUSES_PEDIDO.includes(statusOp)) return "ok";
  const daysLeft = calculateDaysBetween(new Date(), dataPrazo);
  if (daysLeft < 0) return "atrasado";
  if (daysLeft <= PRAZO_ALERTA_DIAS) return "proximo";
  return "ok";
}

function PrazoBadge({ dataPrazo, status }: { dataPrazo: string | null; status: string }) {
  if (!dataPrazo) return <span className="text-muted-foreground text-xs">—</span>;
  const ps = getPrazoStatus(dataPrazo, status);
  const daysLeft = calculateDaysBetween(new Date(), dataPrazo);

  if (ps === "atrasado") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-destructive font-medium">{formatDate(dataPrazo)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />Atrasado
        </Badge>
      </span>
    );
  }
  if (ps === "proximo") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-amber-600 font-medium">{formatDate(dataPrazo)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200 gap-1">
          <Clock className="h-2.5 w-2.5" />{daysLeft}d restantes
        </Badge>
      </span>
    );
  }
  return <span className="text-xs">{formatDate(dataPrazo)}</span>;
}

const statusOperacionalLabels: Record<string, string> = {
  pendente: "Aguardando",
  aprovada: "Aprovado",
  em_separacao: "Em Separação",
  separado: "Separado",
  em_transporte: "Em Transporte",
  entregue: "Entregue",
  faturado: "Faturado",
  cancelada: "Cancelado",
};

const statusFaturamentoLabels: Record<string, string> = {
  aguardando: "Aguardando",
  parcial: "Parcial",
  total: "Faturado",
};
const statusFaturamentoColors: Record<string, string> = {
  aguardando: "bg-warning/10 text-warning border-warning/30",
  parcial: "bg-info/10 text-info border-info/30",
  total: "bg-success/10 text-success border-success/30",
};

const prazoFilterOptions: MultiSelectOption[] = [
  { label: "Atrasados", value: "atrasado" },
  { label: `Próximos (≤${PRAZO_ALERTA_DIAS}d)`, value: "proximo" },
  { label: "No prazo", value: "ok" },
  { label: "Sem prazo", value: "sem_prazo" },
];

const Pedidos = () => {
  const { pushView } = useRelationalNavigation();
  const { data, loading, fetchData } = useSupabaseCrud<Pedido>({
    table: "ordens_venda", select: "*, clientes(nome_razao_social), orcamentos(numero)",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [faturamentoFilters, setFaturamentoFilters] = useState<string[]>([]);
  const [clienteFilters, setClienteFilters] = useState<string[]>([]);
  const [prazoFilters, setPrazoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [generatingNfId, setGeneratingNfId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("clientes").select("id, nome_razao_social").eq("ativo", true).then(({ data }) => setClientesList(data || []));
  }, []);

  const kpis = useMemo(() => {
    const total = data.length;
    const totalValue = data.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const emAndamento = data.filter(o => ["em_separacao", "separado", "em_transporte"].includes(o.status)).length;
    const atrasados = data.filter(o => getPrazoStatus(o.data_prometida_despacho, o.status) === "atrasado").length;
    return { total, totalValue, emAndamento, atrasados };
  }, [data]);

  const handleView = (pedido: Pedido) => {
    pushView("ordem_venda", pedido.id);
  };

  const handleGenerateNF = async (pedido: Pedido) => {
    try {
      const { data: pedidoItems } = await supabase.from("ordens_venda_itens").select("*").eq("ordem_venda_id", pedido.id);
      const { count } = await supabase.from("notas_fiscais").select("*", { count: "exact", head: true });
      const nfNumero = String((count || 0) + 1).padStart(6, "0");

      const totalProdutos = (pedidoItems || []).reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0);

      const { data: newNF, error } = await supabase.from("notas_fiscais").insert({
        numero: nfNumero,
        tipo: "saida",
        data_emissao: new Date().toISOString().split("T")[0],
        cliente_id: pedido.cliente_id,
        ordem_venda_id: pedido.id,
        valor_total: totalProdutos,
        status: "pendente",
        movimenta_estoque: true,
        gera_financeiro: true,
        observacoes: `Gerada a partir do Pedido ${pedido.numero}`,
      }).select().single();

      if (error) throw error;

      if (pedidoItems && pedidoItems.length > 0 && newNF) {
        const nfItems = pedidoItems.map((i: any) => ({
          nota_fiscal_id: newNF.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
        }));
        await supabase.from("notas_fiscais_itens").insert(nfItems);
      }

      if (pedidoItems) {
        for (const item of pedidoItems) {
          const novaQtdFaturada = (item.quantidade_faturada || 0) + item.quantidade;
          await supabase.from("ordens_venda_itens").update({
            quantidade_faturada: novaQtdFaturada,
          }).eq("id", item.id);
        }
      }

      const { data: updatedItems } = await supabase
        .from("ordens_venda_itens")
        .select("quantidade, quantidade_faturada")
        .eq("ordem_venda_id", pedido.id);
      const totalQ = (updatedItems || []).reduce((s: number, i: any) => s + Number(i.quantidade), 0);
      const totalF = (updatedItems || []).reduce((s: number, i: any) => s + Number(i.quantidade_faturada || 0), 0);
      const newFatStatus = calcularStatusFaturamentoOV(totalQ, totalF);

      await supabase.from("ordens_venda").update({ status_faturamento: newFatStatus }).eq("id", pedido.id);

      toast.success(`NF ${nfNumero} gerada a partir do Pedido ${pedido.numero}!`);
      fetchData();
    } catch (err: any) {
      console.error('[pedidos] gerar NF:', err);
      toast.error("Erro ao gerar Nota Fiscal.");
    } finally {
      setGeneratingNfId(null);
    }
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((pedido) => {
      if (statusFilters.length > 0 && !statusFilters.includes(pedido.status)) return false;
      if (faturamentoFilters.length > 0 && !faturamentoFilters.includes(pedido.status_faturamento)) return false;
      if (clienteFilters.length > 0 && !clienteFilters.includes(pedido.cliente_id || "")) return false;

      if (prazoFilters.length > 0) {
        const ps = getPrazoStatus(pedido.data_prometida_despacho, pedido.status);
        if (!prazoFilters.includes(ps)) return false;
      }

      if (dataInicio) {
        const emissao = pedido.data_emissao;
        if (!emissao || emissao < dataInicio) return false;
      }
      if (dataFim) {
        const emissao = pedido.data_emissao;
        if (!emissao || emissao > dataFim) return false;
      }

      if (!query) return true;
      return [pedido.numero, pedido.clientes?.nome_razao_social, pedido.orcamentos?.numero, pedido.po_number, pedido.observacoes].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, faturamentoFilters, searchTerm, statusFilters, clienteFilters, prazoFilters, dataInicio, dataFim]);

  const activeFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach(f => {
      chips.push({ key: "status",
      mobileCard: true, label: "Status", value: [f], displayValue: statusOperacionalLabels[f] || f });
    });
    faturamentoFilters.forEach(f => {
      chips.push({ key: "faturamento", label: "Faturamento", value: [f], displayValue: statusFaturamentoLabels[f] || f });
    });
    clienteFilters.forEach(f => {
      const cli = clientesList.find(x => x.id === f);
      chips.push({ key: "cliente",
      mobilePrimary: true, label: "Cliente", value: [f], displayValue: cli?.nome_razao_social || f });
    });
    prazoFilters.forEach(f => {
      const opt = prazoFilterOptions.find(x => x.value === f);
      chips.push({ key: "prazo", label: "Prazo", value: [f], displayValue: opt?.label || f });
    });
    if (dataInicio) chips.push({ key: "dataInicio", label: "Emissão desde", value: [dataInicio], displayValue: formatDate(dataInicio) });
    if (dataFim) chips.push({ key: "dataFim", label: "Emissão até", value: [dataFim], displayValue: formatDate(dataFim) });
    return chips;
  }, [statusFilters, faturamentoFilters, clienteFilters, prazoFilters, dataInicio, dataFim, clientesList]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "faturamento") setFaturamentoFilters(prev => prev.filter(v => v !== value));
    if (key === "cliente") setClienteFilters(prev => prev.filter(v => v !== value));
    if (key === "prazo") setPrazoFilters(prev => prev.filter(v => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusOperacionalLabels).map(([k, v]) => ({ label: v, value: k }));
  const faturamentoOptions: MultiSelectOption[] = Object.entries(statusFaturamentoLabels).map(([k, v]) => ({ label: v, value: k }));
  const clienteOptions: MultiSelectOption[] = clientesList.map(c => ({ label: c.nome_razao_social, value: c.id }));

  const columns = [
    {
      key: "numero",
      mobileCard: true, label: "Nº Pedido", sortable: true,
      render: (p: Pedido) => <span className="font-mono text-xs font-semibold text-primary">{p.numero}</span>,
    },
    {
      key: "cliente", label: "Cliente",
      render: (p: Pedido) => <span className="font-medium text-sm">{p.clientes?.nome_razao_social || "—"}</span>,
    },
    {
      key: "data_emissao", label: "Data Pedido", sortable: true,
      render: (p: Pedido) => <span className="text-xs">{formatDate(p.data_emissao)}</span>,
    },
    {
      key: "prazo", label: "Prazo Despacho",
      render: (p: Pedido) => <PrazoBadge dataPrazo={p.data_prometida_despacho} status={p.status} />,
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (p: Pedido) => <StatusBadge status={p.status} label={statusOperacionalLabels[p.status]} />,
    },
    {
      key: "faturamento", label: "Faturamento",
      render: (p: Pedido) => (
        <Badge variant="outline" className={`text-xs ${statusFaturamentoColors[p.status_faturamento] || ""}`}>
          {statusFaturamentoLabels[p.status_faturamento] || p.status_faturamento}
        </Badge>
      ),
    },
    {
      key: "valor_total",
      mobileCard: true, label: "Total", sortable: true,
      render: (p: Pedido) => <span className="font-semibold font-mono text-sm">{formatCurrency(Number(p.valor_total || 0))}</span>,
    },
    {
      key: "po_number", label: "PO Cliente", hidden: true,
      render: (p: Pedido) => p.po_number ? <span className="font-mono text-xs">{p.po_number}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "cotacao", label: "Cotação", hidden: true,
      render: (p: Pedido) => p.orcamentos?.numero ? <span className="font-mono text-xs">{p.orcamentos.numero}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "dias", label: "Dias em Aberto", hidden: true,
      render: (p: Pedido) => {
        const dias = daysSince(p.data_emissao);
        return <span className={`font-mono text-xs ${dias > DIAS_ABERTO_ALERTA ? "text-destructive font-bold" : "text-muted-foreground"}`}>{dias}d</span>;
      },
    },
    {
      key: "acoes", label: "Ações", sortable: false,
      render: (p: Pedido) => (
        <div className="flex gap-1">
          {(p.status === "aprovada" || p.status === "em_separacao") && p.status_faturamento !== "total" && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setGeneratingNfId(p.id); }}>
              <FileOutput className="w-3 h-3" /> Gerar NF
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Pedidos"
        subtitle="Central de consulta e acompanhamento operacional do ciclo de venda"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Total de Pedidos" value={formatNumber(kpis.total)} icon={FileText} variationType="neutral" variation="registros" />
          <SummaryCard title="Valor Total" value={formatCurrency(kpis.totalValue)} icon={DollarSign} variationType="neutral" variation="acumulado" />
          <SummaryCard title="Em Andamento" value={formatNumber(kpis.emAndamento)} icon={Truck} variationType="positive" variation="separação / transporte" />
          <SummaryCard title="Atrasados" value={formatNumber(kpis.atrasados)} icon={AlertTriangle} variationType={kpis.atrasados > 0 ? "negative" as const : "neutral" as const} variation="fora do prazo de despacho" />
        </div>

        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por número, PO, cliente ou cotação..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setStatusFilters([]); setFaturamentoFilters([]); setClienteFilters([]); setPrazoFilters([]); setDataInicio(""); setDataFim(""); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            placeholder="Status"
            className="w-[180px]"
          />
          <MultiSelect
            options={faturamentoOptions}
            selected={faturamentoFilters}
            onChange={setFaturamentoFilters}
            placeholder="Faturamento"
            className="w-[180px]"
          />
          <MultiSelect
            options={prazoFilterOptions}
            selected={prazoFilters}
            onChange={setPrazoFilters}
            placeholder="Prazo"
            className="w-[180px]"
          />
          <MultiSelect
            options={clienteOptions}
            selected={clienteFilters}
            onChange={setClienteFilters}
            placeholder="Clientes"
            className="w-[200px]"
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
          moduleKey="pedidos"
          showColumnToggle={true}
          onView={handleView}
        />
      </ModulePage>

      <ConfirmDialog
        open={!!generatingNfId}
        onClose={() => setGeneratingNfId(null)}
        onConfirm={() => {
          const pedido = data.find(o => o.id === generatingNfId);
          if (pedido) handleGenerateNF(pedido);
        }}
        title="Gerar Nota Fiscal"
        description={`Deseja gerar uma Nota Fiscal de saída para o Pedido ${data.find(o => o.id === generatingNfId)?.numero || ""}? Todos os itens serão incluídos.`}
      />
    </AppLayout>
  );
};

export default Pedidos;
