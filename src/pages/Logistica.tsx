import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { toast } from "sonner";
import { formatNumber, formatDate } from "@/lib/format";
import { EntregaDrawer } from "@/components/logistica/EntregaDrawer";
import {
  Eye, AlertTriangle, Truck, Package, CheckCheck, ExternalLink,
} from "lucide-react";

type Entrega = {
  id: string;
  numero_pedido: string;
  cliente: string;
  cidade_uf: string;
  transportadora: string;
  volumes: number;
  peso_total: number;
  previsao_envio: string | null;
  previsao_entrega: string | null;
  data_expedicao: string | null;
  status_logistico: string;
  responsavel: string;
  codigo_rastreio: string | null;
};

type Recebimento = {
  id: string;
  numero_compra: string;
  fornecedor: string;
  previsao_entrega: string | null;
  data_recebimento: string | null;
  quantidade_pedida: number;
  quantidade_recebida: number;
  pendencia: number;
  status_logistico: string;
  nf_vinculada: string | null;
  responsavel: string;
};

const entregaStatusOptions = [
  "aguardando_separacao",
  "em_separacao",
  "separado",
  "aguardando_expedicao",
  "em_transporte",
  "entregue",
  "entrega_parcial",
  "ocorrencia",
  "cancelado",
] as const;

const recebimentoStatusOptions = [
  "pedido_emitido",
  "aguardando_envio_fornecedor",
  "em_transito",
  "recebimento_parcial",
  "recebido",
  "recebido_com_divergencia",
  "atrasado",
  "cancelado",
] as const;

const logisticaStatusMap: Record<string, { label: string; badgeStatus: string }> = {
  aguardando_separacao: { label: "Aguardando Separação", badgeStatus: "aguardando" },
  em_separacao:         { label: "Em Separação",         badgeStatus: "em_separacao" },
  separado:             { label: "Separado",             badgeStatus: "aprovado" },
  aguardando_expedicao: { label: "Aguardando Expedição", badgeStatus: "aguardando" },
  em_transporte:        { label: "Em Transporte",        badgeStatus: "enviado" },
  entregue:             { label: "Entregue",             badgeStatus: "entregue" },
  entrega_parcial:      { label: "Entrega Parcial",      badgeStatus: "parcial" },
  ocorrencia:           { label: "Com Ocorrência",       badgeStatus: "pendente" },
  cancelado:            { label: "Cancelado",            badgeStatus: "cancelado" },
};

const recebimentoStatusMap: Record<string, { label: string; badgeStatus: string }> = {
  pedido_emitido:              { label: "Pedido Emitido",       badgeStatus: "pendente" },
  aguardando_envio_fornecedor: { label: "Aguardando Envio",     badgeStatus: "aguardando" },
  em_transito:                 { label: "Em Trânsito",          badgeStatus: "enviado" },
  recebimento_parcial:         { label: "Recebimento Parcial",  badgeStatus: "parcial" },
  recebido:                    { label: "Recebido",             badgeStatus: "entregue" },
  recebido_com_divergencia:    { label: "Com Divergência",      badgeStatus: "pendente" },
  atrasado:                    { label: "Atrasado",             badgeStatus: "vencido" },
  cancelado:                   { label: "Cancelado",            badgeStatus: "cancelado" },
};

function getEntregaStatusCfg(status: string) {
  return logisticaStatusMap[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}

function getRecebimentoStatusCfg(status: string) {
  return recebimentoStatusMap[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}

const TERMINAL_ENTREGA = ["entregue", "cancelado"];
const TERMINAL_RECEBIMENTO = ["recebido", "cancelado"];

function isAtrasadoEntrega(e: Entrega): boolean {
  if (!e.previsao_entrega) return false;
  if (TERMINAL_ENTREGA.includes(e.status_logistico)) return false;
  return new Date(e.previsao_entrega + "T00:00:00") < new Date();
}

function isAtrasadoRecebimento(r: Recebimento): boolean {
  if (!r.previsao_entrega) return false;
  if (TERMINAL_RECEBIMENTO.includes(r.status_logistico)) return false;
  return new Date(r.previsao_entrega + "T00:00:00") < new Date();
}

const entregaStatusMultiOptions: MultiSelectOption[] = Object.entries(logisticaStatusMap).map(
  ([k, v]) => ({ value: k, label: v.label }),
);
const recebimentoStatusMultiOptions: MultiSelectOption[] = Object.entries(recebimentoStatusMap).map(
  ([k, v]) => ({ value: k, label: v.label }),
);
const prazoOptions: MultiSelectOption[] = [
  { label: "Atrasadas", value: "atrasado" },
  { label: "No prazo", value: "ok" },
];
const prazoOptionsReceb: MultiSelectOption[] = [
  { label: "Atrasados", value: "atrasado" },
  { label: "No prazo", value: "ok" },
];

export default function Logistica() {
  const { can } = useAuth();
  const { pushView } = useRelationalNavigation();

  const [loading, setLoading] = useState(true);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [transportadorasList, setTransportadorasList] = useState<string[]>([]);
  const [fornecedoresList, setFornecedoresList] = useState<string[]>([]);

  /* Entregas filters */
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [transportadoraFilters, setTransportadoraFilters] = useState<string[]>([]);
  const [prazoFilters, setPrazoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  /* Recebimentos filters */
  const [searchTermReceb, setSearchTermReceb] = useState("");
  const [statusFiltersReceb, setStatusFiltersReceb] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);
  const [prazoFiltersReceb, setPrazoFiltersReceb] = useState<string[]>([]);
  const [dataInicioReceb, setDataInicioReceb] = useState("");
  const [dataFimReceb, setDataFimReceb] = useState("");

  const canEdit = can("logistica", "editar");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ordensRes, remessasRes, clientesRes, transportadorasRes, itensOvRes, comprasRes, itensCompraRes, fornecedoresRes] = await Promise.all([
          supabase.from("ordens_venda").select("id,numero,cliente_id,data_prometida_despacho,usuario_id,created_at,updated_at").eq("ativo", true),
          supabase.from("remessas").select("id,ordem_venda_id,transportadora_id,status_transporte,data_postagem,previsao_entrega,volumes,peso,codigo_rastreio,updated_at").eq("ativo", true),
          supabase.from("clientes").select("id,nome_razao_social,cidade,uf"),
          supabase.from("transportadoras").select("id,nome_razao_social"),
          supabase.from("ordens_venda_itens").select("ordem_venda_id,peso_total,quantidade"),
          supabase.from("pedidos_compra").select("id,numero,fornecedor_id,data_entrega_prevista,data_entrega_real,status,usuario_id,updated_at").eq("ativo", true),
          supabase.from("pedidos_compra_itens").select("pedido_compra_id,quantidade"),
          supabase.from("fornecedores").select("id,nome_razao_social"),
        ]);

        const clienteMap = new Map((clientesRes.data || []).map((c) => [c.id, c]));
        const transportadoraMap = new Map((transportadorasRes.data || []).map((t) => [t.id, t.nome_razao_social]));
        const remessaByPedido = new Map((remessasRes.data || []).map((r) => [r.ordem_venda_id || "", r]));

        const pesoByOrder = new Map<string, { peso: number; qtd: number }>();
        (itensOvRes.data || []).forEach((item) => {
          const current = pesoByOrder.get(item.ordem_venda_id) || { peso: 0, qtd: 0 };
          pesoByOrder.set(item.ordem_venda_id, {
            peso: current.peso + Number(item.peso_total || 0),
            qtd: current.qtd + Number(item.quantidade || 0),
          });
        });

        const entregaRows: Entrega[] = (ordensRes.data || []).map((ov) => {
          const remessa = remessaByPedido.get(ov.id);
          const cliente = clienteMap.get(ov.cliente_id || "");
          const pesoQtd = pesoByOrder.get(ov.id) || { peso: 0, qtd: 0 };
          return {
            id: ov.id,
            numero_pedido: ov.numero,
            cliente: cliente?.nome_razao_social || "—",
            cidade_uf: [cliente?.cidade, cliente?.uf].filter(Boolean).join("/") || "—",
            transportadora: transportadoraMap.get(remessa?.transportadora_id || "") || "—",
            volumes: Number(remessa?.volumes || 0),
            peso_total: Number(remessa?.peso || pesoQtd.peso || 0),
            previsao_envio: ov.data_prometida_despacho,
            previsao_entrega: remessa?.previsao_entrega || null,
            data_expedicao: remessa?.data_postagem || null,
            status_logistico: remessa?.status_transporte || "aguardando_separacao",
            responsavel: ov.usuario_id || "—",
            codigo_rastreio: remessa?.codigo_rastreio || null,
          };
        });

        const fornecedorMap = new Map((fornecedoresRes.data || []).map((f) => [f.id, f.nome_razao_social]));
        const qtyByCompra = new Map<string, number>();
        (itensCompraRes.data || []).forEach((item) => {
          qtyByCompra.set(item.pedido_compra_id, (qtyByCompra.get(item.pedido_compra_id) || 0) + Number(item.quantidade || 0));
        });

        const qtdRecebidaByCompra = new Map<string, number>();
        (remessasRes.data || [])
          .filter((item) => item && item.status_transporte === "entregue")
          .forEach((item) => {
            if (!item.id) return;
          });

        const recebimentoRows: Recebimento[] = (comprasRes.data || []).map((compra) => {
          const qtdPedida = qtyByCompra.get(compra.id) || 0;
          const qtdRecebida = compra.data_entrega_real ? qtdPedida : 0;
          const pendencia = Math.max(0, qtdPedida - qtdRecebida);
          return {
            id: compra.id,
            numero_compra: compra.numero,
            fornecedor: fornecedorMap.get(compra.fornecedor_id || "") || "—",
            previsao_entrega: compra.data_entrega_prevista,
            data_recebimento: compra.data_entrega_real,
            quantidade_pedida: qtdPedida,
            quantidade_recebida: qtdRecebidaByCompra.get(compra.id) || qtdRecebida,
            pendencia,
            status_logistico: compra.data_entrega_real
              ? (pendencia > 0 ? "recebimento_parcial" : "recebido")
              : (compra.status || "pedido_emitido"),
            nf_vinculada: null,
            responsavel: compra.usuario_id || "—",
          };
        });

        setEntregas(entregaRows);
        setRecebimentos(recebimentoRows);

        const uniqueTransportadoras = [...new Set(entregaRows.map((e) => e.transportadora).filter((t) => t !== "—"))].sort();
        const uniqueFornecedores = [...new Set(recebimentoRows.map((r) => r.fornecedor).filter((f) => f !== "—"))].sort();
        setTransportadorasList(uniqueTransportadoras);
        setFornecedoresList(uniqueFornecedores);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* ── KPIs ── */
  const entregasKpis = useMemo(() => {
    const total = entregas.length;
    const emTransporte = entregas.filter((e) => e.status_logistico === "em_transporte").length;
    const atrasadas = entregas.filter(isAtrasadoEntrega).length;
    const entregues = entregas.filter((e) => e.status_logistico === "entregue").length;
    return { total, emTransporte, atrasadas, entregues };
  }, [entregas]);

  const recebimentosKpis = useMemo(() => {
    const total = recebimentos.length;
    const emTransito = recebimentos.filter((r) => r.status_logistico === "em_transito").length;
    const atrasados = recebimentos.filter(isAtrasadoRecebimento).length;
    const recebidos = recebimentos.filter((r) => r.status_logistico === "recebido").length;
    return { total, emTransito, atrasados, recebidos };
  }, [recebimentos]);

  /* ── Filtered entregas ── */
  const filteredEntregas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return entregas.filter((e) => {
      if (statusFilters.length > 0 && !statusFilters.includes(e.status_logistico)) return false;
      if (transportadoraFilters.length > 0 && !transportadoraFilters.includes(e.transportadora)) return false;
      if (prazoFilters.length > 0) {
        const ps = isAtrasadoEntrega(e) ? "atrasado" : "ok";
        if (!prazoFilters.includes(ps)) return false;
      }
      if (dataInicio && e.previsao_entrega && e.previsao_entrega < dataInicio) return false;
      if (dataFim && e.previsao_entrega && e.previsao_entrega > dataFim) return false;
      if (!q) return true;
      return [e.numero_pedido, e.cliente, e.transportadora, e.codigo_rastreio]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [entregas, searchTerm, statusFilters, transportadoraFilters, prazoFilters, dataInicio, dataFim]);

  /* ── Filtered recebimentos ── */
  const filteredRecebimentos = useMemo(() => {
    const q = searchTermReceb.trim().toLowerCase();
    return recebimentos.filter((r) => {
      if (statusFiltersReceb.length > 0 && !statusFiltersReceb.includes(r.status_logistico)) return false;
      if (fornecedorFilters.length > 0 && !fornecedorFilters.includes(r.fornecedor)) return false;
      if (prazoFiltersReceb.length > 0) {
        const ps = isAtrasadoRecebimento(r) ? "atrasado" : "ok";
        if (!prazoFiltersReceb.includes(ps)) return false;
      }
      if (dataInicioReceb && r.previsao_entrega && r.previsao_entrega < dataInicioReceb) return false;
      if (dataFimReceb && r.previsao_entrega && r.previsao_entrega > dataFimReceb) return false;
      if (!q) return true;
      return [r.numero_compra, r.fornecedor].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [recebimentos, searchTermReceb, statusFiltersReceb, fornecedorFilters, prazoFiltersReceb, dataInicioReceb, dataFimReceb]);

  /* ── Active filter chips ── */
  const activeEntregaFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach((f) => chips.push({ key: "status", label: "Status", value: [f], displayValue: logisticaStatusMap[f]?.label || f }));
    transportadoraFilters.forEach((f) => chips.push({ key: "transportadora", label: "Transportadora", value: [f], displayValue: f }));
    prazoFilters.forEach((f) => chips.push({ key: "prazo", label: "Prazo", value: [f], displayValue: prazoOptions.find((o) => o.value === f)?.label || f }));
    if (dataInicio) chips.push({ key: "dataInicio", label: "Prev. desde", value: [dataInicio], displayValue: formatDate(dataInicio) });
    if (dataFim) chips.push({ key: "dataFim", label: "Prev. até", value: [dataFim], displayValue: formatDate(dataFim) });
    return chips;
  }, [statusFilters, transportadoraFilters, prazoFilters, dataInicio, dataFim]);

  const activeRecebimentoFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFiltersReceb.forEach((f) => chips.push({ key: "status", label: "Status", value: [f], displayValue: recebimentoStatusMap[f]?.label || f }));
    fornecedorFilters.forEach((f) => chips.push({ key: "fornecedor", label: "Fornecedor", value: [f], displayValue: f }));
    prazoFiltersReceb.forEach((f) => chips.push({ key: "prazo", label: "Prazo", value: [f], displayValue: prazoOptionsReceb.find((o) => o.value === f)?.label || f }));
    if (dataInicioReceb) chips.push({ key: "dataInicio", label: "Prev. desde", value: [dataInicioReceb], displayValue: formatDate(dataInicioReceb) });
    if (dataFimReceb) chips.push({ key: "dataFim", label: "Prev. até", value: [dataFimReceb], displayValue: formatDate(dataFimReceb) });
    return chips;
  }, [statusFiltersReceb, fornecedorFilters, prazoFiltersReceb, dataInicioReceb, dataFimReceb]);

  const handleRemoveEntregaFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((p) => p.filter((v) => v !== value));
    if (key === "transportadora") setTransportadoraFilters((p) => p.filter((v) => v !== value));
    if (key === "prazo") setPrazoFilters((p) => p.filter((v) => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const handleRemoveRecebimentoFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFiltersReceb((p) => p.filter((v) => v !== value));
    if (key === "fornecedor") setFornecedorFilters((p) => p.filter((v) => v !== value));
    if (key === "prazo") setPrazoFiltersReceb((p) => p.filter((v) => v !== value));
    if (key === "dataInicio") setDataInicioReceb("");
    if (key === "dataFim") setDataFimReceb("");
  };

  /* ── Status update actions ── */
  const updateEntregaStatus = async (entrega: Entrega, status: string) => {
    if (!canEdit) return;
    const { data: remessa } = await supabase.from("remessas").select("id").eq("ordem_venda_id", entrega.id).maybeSingle();
    if (!remessa?.id) {
      toast.warning("Nenhuma remessa encontrada para o pedido.");
      return;
    }
    const { error } = await supabase.from("remessas").update({ status_transporte: status }).eq("id", remessa.id);
    if (error) {
      toast.error("Não foi possível atualizar o status da entrega.");
      return;
    }
    setEntregas((prev) => prev.map((item) => item.id === entrega.id ? { ...item, status_logistico: status } : item));
  };

  const updateRecebimentoStatus = async (recebimento: Recebimento, status: string) => {
    if (!canEdit) return;
    const payload: Record<string, unknown> = { status };
    if (status === "recebido") payload.data_entrega_real = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("pedidos_compra").update(payload).eq("id", recebimento.id);
    if (error) {
      toast.error("Não foi possível atualizar o status do recebimento.");
      return;
    }
    setRecebimentos((prev) => prev.map((item) => item.id === recebimento.id ? { ...item, status_logistico: status } : item));
  };

  /* ── Filter option lists ── */
  const transportadoraOptions: MultiSelectOption[] = transportadorasList.map((t) => ({ label: t, value: t }));
  const fornecedorOptions: MultiSelectOption[] = fornecedoresList.map((f) => ({ label: f, value: f }));

  /* ── Columns ── */
  const entregaColumns = [
    {
      key: "numero_pedido", label: "Pedido", sortable: true,
      render: (item: Entrega) => (
        <span className="font-mono text-xs font-semibold text-primary">{item.numero_pedido}</span>
      ),
    },
    {
      key: "cliente", label: "Cliente", sortable: true,
      render: (item: Entrega) => <span className="font-medium text-sm">{item.cliente}</span>,
    },
    {
      key: "transportadora", label: "Transportadora",
      render: (item: Entrega) => (
        item.transportadora === "—"
          ? <span className="text-muted-foreground text-xs">—</span>
          : <span className="text-sm">{item.transportadora}</span>
      ),
    },
    {
      key: "status_logistico", label: "Status", sortable: true,
      render: (item: Entrega) => {
        const cfg = getEntregaStatusCfg(item.status_logistico);
        const atrasado = isAtrasadoEntrega(item);
        return (
          <span className="inline-flex flex-col items-start gap-0.5">
            <StatusBadge status={cfg.badgeStatus} label={cfg.label} />
            {atrasado && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />Atrasada
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: "previsao_entrega", label: "Prev. Entrega",
      render: (item: Entrega) => {
        if (!item.previsao_entrega) return <span className="text-muted-foreground text-xs">—</span>;
        const atrasado = isAtrasadoEntrega(item);
        return (
          <span className={`text-xs ${atrasado ? "text-destructive font-medium" : ""}`}>
            {formatDate(item.previsao_entrega)}
          </span>
        );
      },
    },
    {
      key: "data_expedicao", label: "Expedição",
      render: (item: Entrega) => item.data_expedicao
        ? <span className="text-xs">{formatDate(item.data_expedicao)}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "cidade_uf", label: "Cidade/UF", hidden: true,
      render: (item: Entrega) => <span className="text-xs">{item.cidade_uf}</span>,
    },
    {
      key: "volumes", label: "Volumes", hidden: true,
      render: (item: Entrega) => <span className="text-xs">{formatNumber(item.volumes || 0)}</span>,
    },
    {
      key: "peso_total", label: "Peso", hidden: true,
      render: (item: Entrega) => <span className="text-xs">{formatNumber(item.peso_total || 0)} kg</span>,
    },
    {
      key: "previsao_envio", label: "Prev. Envio", hidden: true,
      render: (item: Entrega) => item.previsao_envio
        ? <span className="text-xs">{formatDate(item.previsao_envio)}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "codigo_rastreio", label: "Rastreio", hidden: true,
      render: (item: Entrega) => item.codigo_rastreio
        ? <span className="font-mono text-xs">{item.codigo_rastreio}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "acoes",
      label: "Ações",
      render: (item: Entrega) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedEntrega(item)}>
            <Eye className="h-3.5 w-3.5" />Ver entrega
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => pushView("ordem_venda", item.id)}>
            <ExternalLink className="h-3.5 w-3.5" />Pedido
          </Button>
          {canEdit ? (
            <Select value={item.status_logistico} onValueChange={(value) => updateEntregaStatus(item, value)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {entregaStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {logisticaStatusMap[status]?.label || status.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground">Somente visualização</span>}
        </div>
      ),
    },
  ];

  const recebimentosColumns = [
    {
      key: "numero_compra", label: "Compra", sortable: true,
      render: (item: Recebimento) => (
        <span className="font-mono text-xs font-semibold text-primary">{item.numero_compra}</span>
      ),
    },
    {
      key: "fornecedor", label: "Fornecedor",
      render: (item: Recebimento) => <span className="font-medium text-sm">{item.fornecedor}</span>,
    },
    {
      key: "status_logistico", label: "Status", sortable: true,
      render: (item: Recebimento) => {
        const cfg = getRecebimentoStatusCfg(item.status_logistico);
        const atrasado = isAtrasadoRecebimento(item);
        return (
          <span className="inline-flex flex-col items-start gap-0.5">
            <StatusBadge status={cfg.badgeStatus} label={cfg.label} />
            {atrasado && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />Atrasado
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: "previsao_entrega", label: "Prev. Entrega",
      render: (item: Recebimento) => {
        if (!item.previsao_entrega) return <span className="text-muted-foreground text-xs">—</span>;
        const atrasado = isAtrasadoRecebimento(item);
        return (
          <span className={`text-xs ${atrasado ? "text-destructive font-medium" : ""}`}>
            {formatDate(item.previsao_entrega)}
          </span>
        );
      },
    },
    {
      key: "data_recebimento", label: "Recebido em",
      render: (item: Recebimento) => item.data_recebimento
        ? <span className="text-xs">{formatDate(item.data_recebimento)}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "quantidade_pedida", label: "Qtd. Pedida",
      render: (item: Recebimento) => <span className="text-xs">{formatNumber(item.quantidade_pedida)}</span>,
    },
    {
      key: "quantidade_recebida", label: "Qtd. Recebida",
      render: (item: Recebimento) => <span className="text-xs">{formatNumber(item.quantidade_recebida)}</span>,
    },
    {
      key: "pendencia", label: "Pendência",
      render: (item: Recebimento) => item.pendencia > 0
        ? <span className="text-xs text-warning font-medium">{formatNumber(item.pendencia)}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "acoes",
      label: "Ações",
      render: (item: Recebimento) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => pushView("pedido_compra", item.id)}>
            <ExternalLink className="h-3.5 w-3.5" />Compra
          </Button>
          {canEdit ? (
            <Select value={item.status_logistico} onValueChange={(value) => updateRecebimentoStatus(item, value)}>
              <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {recebimentoStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {recebimentoStatusMap[status]?.label || status.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground">Somente visualização</span>}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Logística"
        subtitle="Central de consulta e acompanhamento da execução logística."
        addLabel={canEdit ? "Atualizar painel" : undefined}
        onAdd={canEdit ? () => window.location.reload() : undefined}
      >
        {!canEdit && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
            Seu acesso em Logística está em modo de visualização. Solicite ao administrador permissão de edição.
          </div>
        )}

        <Tabs defaultValue="entregas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="entregas">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard title="Total de Entregas" value={formatNumber(entregasKpis.total)} icon={Package} variationType="neutral" variation="operações ativas" />
              <SummaryCard title="Em Transporte" value={formatNumber(entregasKpis.emTransporte)} icon={Truck} variationType="positive" variation="a caminho do cliente" />
              <SummaryCard title="Atrasadas" value={formatNumber(entregasKpis.atrasadas)} icon={AlertTriangle} variationType={entregasKpis.atrasadas > 0 ? "negative" : "neutral"} variation="fora do prazo de entrega" />
              <SummaryCard title="Entregues" value={formatNumber(entregasKpis.entregues)} icon={CheckCheck} variationType="positive" variation="concluídas" />
            </div>

            <AdvancedFilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por pedido, cliente, transportadora ou rastreio..."
              activeFilters={activeEntregaFilters}
              onRemoveFilter={handleRemoveEntregaFilter}
              onClearAll={() => { setStatusFilters([]); setTransportadoraFilters([]); setPrazoFilters([]); setDataInicio(""); setDataFim(""); }}
              count={filteredEntregas.length}
            >
              <MultiSelect
                options={entregaStatusMultiOptions}
                selected={statusFilters}
                onChange={setStatusFilters}
                placeholder="Status"
                className="w-[180px]"
              />
              <MultiSelect
                options={transportadoraOptions}
                selected={transportadoraFilters}
                onChange={setTransportadoraFilters}
                placeholder="Transportadora"
                className="w-[200px]"
              />
              <MultiSelect
                options={prazoOptions}
                selected={prazoFilters}
                onChange={setPrazoFilters}
                placeholder="Prazo"
                className="w-[160px]"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9 w-[140px] text-xs"
                  title="Prev. entrega desde"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9 w-[140px] text-xs"
                  title="Prev. entrega até"
                />
              </div>
            </AdvancedFilterBar>

            <DataTable
              columns={entregaColumns}
              data={filteredEntregas}
              loading={loading}
              moduleKey="logistica-entregas"
              showColumnToggle={true}
            />
          </TabsContent>

          <TabsContent value="recebimentos">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard title="Total de Recebimentos" value={formatNumber(recebimentosKpis.total)} icon={Package} variationType="neutral" variation="pedidos de compra" />
              <SummaryCard title="Em Trânsito" value={formatNumber(recebimentosKpis.emTransito)} icon={Truck} variationType="positive" variation="a caminho do armazém" />
              <SummaryCard title="Atrasados" value={formatNumber(recebimentosKpis.atrasados)} icon={AlertTriangle} variationType={recebimentosKpis.atrasados > 0 ? "negative" : "neutral"} variation="fora do prazo de entrega" />
              <SummaryCard title="Recebidos" value={formatNumber(recebimentosKpis.recebidos)} icon={CheckCheck} variationType="positive" variation="concluídos" />
            </div>

            <AdvancedFilterBar
              searchValue={searchTermReceb}
              onSearchChange={setSearchTermReceb}
              searchPlaceholder="Buscar por número da compra ou fornecedor..."
              activeFilters={activeRecebimentoFilters}
              onRemoveFilter={handleRemoveRecebimentoFilter}
              onClearAll={() => { setStatusFiltersReceb([]); setFornecedorFilters([]); setPrazoFiltersReceb([]); setDataInicioReceb(""); setDataFimReceb(""); }}
              count={filteredRecebimentos.length}
            >
              <MultiSelect
                options={recebimentoStatusMultiOptions}
                selected={statusFiltersReceb}
                onChange={setStatusFiltersReceb}
                placeholder="Status"
                className="w-[180px]"
              />
              <MultiSelect
                options={fornecedorOptions}
                selected={fornecedorFilters}
                onChange={setFornecedorFilters}
                placeholder="Fornecedor"
                className="w-[200px]"
              />
              <MultiSelect
                options={prazoOptionsReceb}
                selected={prazoFiltersReceb}
                onChange={setPrazoFiltersReceb}
                placeholder="Prazo"
                className="w-[160px]"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataInicioReceb}
                  onChange={(e) => setDataInicioReceb(e.target.value)}
                  className="h-9 w-[140px] text-xs"
                  title="Prev. entrega desde"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dataFimReceb}
                  onChange={(e) => setDataFimReceb(e.target.value)}
                  className="h-9 w-[140px] text-xs"
                  title="Prev. entrega até"
                />
              </div>
            </AdvancedFilterBar>

            <DataTable
              columns={recebimentosColumns}
              data={filteredRecebimentos}
              loading={loading}
              moduleKey="logistica-recebimentos"
              showColumnToggle={true}
            />
          </TabsContent>
        </Tabs>
      </ModulePage>

      <EntregaDrawer
        open={!!selectedEntrega}
        onClose={() => setSelectedEntrega(null)}
        entrega={selectedEntrega}
      />
    </AppLayout>
  );
}
