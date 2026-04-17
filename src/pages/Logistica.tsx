import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { toast } from "sonner";
import { formatNumber, formatDate } from "@/lib/format";
import { format } from "date-fns";
import { EntregaDrawer } from "@/components/logistica/EntregaDrawer";
import { RecebimentoDrawer } from "@/components/logistica/RecebimentoDrawer";
import { statusRemessa } from "@/lib/statusSchema";
import { useEntregas } from "@/pages/logistica/hooks/useEntregas";
import type { Entrega } from "@/pages/logistica/hooks/useEntregas";
import { useRecebimentos } from "@/pages/logistica/hooks/useRecebimentos";
import type { Recebimento } from "@/pages/logistica/hooks/useRecebimentos";
import { trackAndPersistEventos } from "@/services/logistica/remessas.service";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  Eye, AlertTriangle, Truck, Package, CheckCheck, ExternalLink, Loader2,
  Edit, Trash2, Plus, MapPin, Package as PackageIcon, Search, Clock, Timer,
} from "lucide-react";

// ─── Remessa types ───
type Remessa = Tables<"remessas">;
type RemessaEvento = Tables<"remessa_eventos">;

// ─── Status maps ───
const entregaStatusOptions = [
  "aguardando_separacao", "em_separacao", "separado", "aguardando_expedicao",
  "em_transporte", "entregue", "entrega_parcial", "ocorrencia", "cancelado",
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

// statusRemessa now includes postado, coletado and cancelado — use directly
const remessaStatusMap: Record<string, { label: string; color: string }> = { ...statusRemessa };

function getEntregaStatusCfg(status: string) {
  return logisticaStatusMap[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}
function getRecebimentoStatusCfg(status: string) {
  return recebimentoStatusMap[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}

const TERMINAL_ENTREGA = ["entregue", "cancelado"];
const TERMINAL_RECEBIMENTO = ["recebido", "cancelado"];

function isAtrasadoEntrega(e: Entrega): boolean {
  if (!e.previsao_entrega || TERMINAL_ENTREGA.includes(e.status_logistico)) return false;
  return new Date(e.previsao_entrega + "T00:00:00") < new Date();
}
function isAtrasadoRecebimento(r: Recebimento): boolean {
  if (!r.previsao_entrega || TERMINAL_RECEBIMENTO.includes(r.status_logistico)) return false;
  return new Date(r.previsao_entrega + "T00:00:00") < new Date();
}

const entregaStatusMultiOptions: MultiSelectOption[] = Object.entries(logisticaStatusMap).map(([k, v]) => ({ value: k, label: v.label }));
const recebimentoStatusMultiOptions: MultiSelectOption[] = Object.entries(recebimentoStatusMap).map(([k, v]) => ({ value: k, label: v.label }));
const prazoOptions: MultiSelectOption[] = [{ label: "Atrasadas", value: "atrasado" }, { label: "No prazo", value: "ok" }];
const prazoOptionsReceb: MultiSelectOption[] = [{ label: "Atrasados", value: "atrasado" }, { label: "No prazo", value: "ok" }];

export default function Logistica() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { pushView } = useRelationalNavigation();
  const canEdit = can("logistica", "editar");

  // ─── Entregas / Recebimentos via hooks ───
  const { data: entregas = [], isLoading: entregasLoading } = useEntregas();
  const { data: recebimentos = [], isLoading: recebimentosLoading } = useRecebimentos();
  const loading = entregasLoading || recebimentosLoading;
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);

  // Derived lists for filters (computed from hook data)
  const transportadorasList = useMemo(
    () => [...new Set(entregas.map((e) => e.transportadora).filter((t) => t !== "—"))].sort(),
    [entregas],
  );
  const fornecedoresList = useMemo(
    () => [...new Set(recebimentos.map((r) => r.fornecedor).filter((f) => f !== "—"))].sort(),
    [recebimentos],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [transportadoraFilters, setTransportadoraFilters] = useState<string[]>([]);
  const [prazoFilters, setPrazoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [searchTermReceb, setSearchTermReceb] = useState("");
  const [statusFiltersReceb, setStatusFiltersReceb] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);
  const [prazoFiltersReceb, setPrazoFiltersReceb] = useState<string[]>([]);
  const [dataInicioReceb, setDataInicioReceb] = useState("");
  const [dataFimReceb, setDataFimReceb] = useState("");

  // ─── Remessas CRUD state (still using useSupabaseCrud for full CRUD) ───
  const { data: remessasData, loading: remessasLoading, update: updateRemessa, remove: removeRemessa } = useSupabaseCrud<Remessa>({ table: "remessas" });
  const [remDrawerOpen, setRemDrawerOpen] = useState(false);
  const [remSelected, setRemSelected] = useState<Remessa | null>(null);
  const [remSearchTerm, setRemSearchTerm] = useState("");
  const [remStatusFilters, setRemStatusFilters] = useState<string[]>([]);
  const [remTranspFilters, setRemTranspFilters] = useState<string[]>([]);

  const [clientes, setClientes] = useState<Array<{ id: string; nome_razao_social: string }>>([]);
  const [transportadorasLookup, setTransportadorasLookup] = useState<Array<{ id: string; nome_razao_social: string }>>([]);
  const [pedidosCompra, setPedidosCompra] = useState<Array<{ id: string; numero: string | null }>>([]);
  const [notasFiscais, setNotasFiscais] = useState<Array<{ id: string; numero: string | null; tipo: string | null }>>([]);
  const [eventos, setEventos] = useState<RemessaEvento[]>([]);
  const [eventoForm, setEventoForm] = useState({ descricao: "", local: "" });
  const [savingEvento, setSavingEvento] = useState(false);
  const [isMockTracking, setIsMockTracking] = useState(false);

  // ─── Load lookup tables for remessa form ───
  useEffect(() => {
    supabase.from("clientes").select("id,nome_razao_social").eq("ativo", true).then(({ data: d }) => setClientes(d ?? []));
    supabase.from("transportadoras").select("id,nome_razao_social").eq("ativo", true).then(({ data: d }) => setTransportadorasLookup(d ?? []));
    supabase.from("pedidos_compra").select("id, numero").eq("ativo", true).then(({ data: d }) => setPedidosCompra(d ?? []));
    supabase.from("notas_fiscais").select("id, numero, tipo").eq("ativo", true).then(({ data: d }) => setNotasFiscais(d ?? []));
  }, []);

  // Load events when remessa drawer opens
  useEffect(() => {
    if (remSelected && remDrawerOpen) {
      supabase.from("remessa_eventos").select("*").eq("remessa_id", remSelected.id).order("data_hora", { ascending: false })
        .then(({ data: d }) => setEventos((d ?? []) as RemessaEvento[]));
    }
  }, [remSelected, remDrawerOpen]);

  // ─── Derived maps ───
  const clienteMapLookup = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c.nome_razao_social])), [clientes]);
  const transpMapLookup = useMemo(() => Object.fromEntries(transportadorasLookup.map(t => [t.id, t.nome_razao_social])), [transportadorasLookup]);

  // ─── KPIs ───
  const entregasKpis = useMemo(() => {
    const total = entregas.length;
    const emTransporte = entregas.filter((e) => e.status_logistico === "em_transporte").length;
    const atrasadas = entregas.filter(isAtrasadoEntrega).length;
    const entregues = entregas.filter((e) => e.status_logistico === "entregue").length;

    // Percentual de entregas no prazo (entregues que não estavam atrasadas no momento da entrega)
    const entreguesNoPrazo = entregas.filter(
      (e) => e.status_logistico === "entregue" && !isAtrasadoEntrega(e),
    ).length;
    const percentualNoPrazo = entregues > 0 ? Math.round((entreguesNoPrazo / entregues) * 100) : null;

    // Tempo médio de entrega em dias (data_expedicao → previsao_entrega como proxy quando
    // a data real de entrega não está disponível na interface atual)
    const entregasComDias = entregas.filter(
      (e) =>
        e.status_logistico === "entregue" &&
        e.data_expedicao &&
        e.previsao_entrega,
    );
    const tempoMedioDias =
      entregasComDias.length > 0
        ? Math.round(
            entregasComDias.reduce((sum, e) => {
              const dias =
                (new Date(e.previsao_entrega!).getTime() -
                  new Date(e.data_expedicao!).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + Math.max(0, dias);
            }, 0) / entregasComDias.length,
          )
        : null;

    return { total, emTransporte, atrasadas, entregues, percentualNoPrazo, tempoMedioDias };
  }, [entregas]);

  const recebimentosKpis = useMemo(() => {
    const total = recebimentos.length;
    const emTransito = recebimentos.filter((r) => r.status_logistico === "em_transito").length;
    const atrasados = recebimentos.filter(isAtrasadoRecebimento).length;
    const recebidos = recebimentos.filter((r) => r.status_logistico === "recebido").length;
    return { total, emTransito, atrasados, recebidos };
  }, [recebimentos]);

  // ─── Filtered entregas ───
  const filteredEntregas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return entregas.filter((e) => {
      if (statusFilters.length > 0 && !statusFilters.includes(e.status_logistico)) return false;
      if (transportadoraFilters.length > 0 && !transportadoraFilters.includes(e.transportadora)) return false;
      if (prazoFilters.length > 0) { const ps = isAtrasadoEntrega(e) ? "atrasado" : "ok"; if (!prazoFilters.includes(ps)) return false; }
      if (dataInicio && e.previsao_entrega && e.previsao_entrega < dataInicio) return false;
      if (dataFim && e.previsao_entrega && e.previsao_entrega > dataFim) return false;
      if (!q) return true;
      return [e.numero_pedido, e.cliente, e.transportadora, e.codigo_rastreio].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [entregas, searchTerm, statusFilters, transportadoraFilters, prazoFilters, dataInicio, dataFim]);

  // ─── Filtered recebimentos ───
  const filteredRecebimentos = useMemo(() => {
    const q = searchTermReceb.trim().toLowerCase();
    return recebimentos.filter((r) => {
      if (statusFiltersReceb.length > 0 && !statusFiltersReceb.includes(r.status_logistico)) return false;
      if (fornecedorFilters.length > 0 && !fornecedorFilters.includes(r.fornecedor)) return false;
      if (prazoFiltersReceb.length > 0) { const ps = isAtrasadoRecebimento(r) ? "atrasado" : "ok"; if (!prazoFiltersReceb.includes(ps)) return false; }
      if (dataInicioReceb && r.previsao_entrega && r.previsao_entrega < dataInicioReceb) return false;
      if (dataFimReceb && r.previsao_entrega && r.previsao_entrega > dataFimReceb) return false;
      if (!q) return true;
      return [r.numero_compra, r.fornecedor].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [recebimentos, searchTermReceb, statusFiltersReceb, fornecedorFilters, prazoFiltersReceb, dataInicioReceb, dataFimReceb]);

  // ─── Filtered remessas ───
  const filteredRemessas = useMemo(() => {
    const q = remSearchTerm.trim().toLowerCase();
    return remessasData.filter((r) => {
      if (remStatusFilters.length > 0 && !remStatusFilters.includes(r.status_transporte ?? "")) return false;
      if (remTranspFilters.length > 0 && !remTranspFilters.includes(r.transportadora_id ?? "")) return false;
      if (!q) return true;
      return [r.codigo_rastreio, clienteMapLookup[r.cliente_id ?? ""], transpMapLookup[r.transportadora_id ?? ""]]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [remessasData, remSearchTerm, clienteMapLookup, transpMapLookup, remStatusFilters, remTranspFilters]);

  // ─── Entrega filter chips ───
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

  const remActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    remStatusFilters.forEach(f => chips.push({ key: "status", label: "Status", value: [f], displayValue: remessaStatusMap[f]?.label || f }));
    remTranspFilters.forEach(f => {
      const t = transportadorasLookup.find(x => x.id === f);
      chips.push({ key: "transportadora", label: "Transportadora", value: [f], displayValue: t?.nome_razao_social || f });
    });
    return chips;
  }, [remStatusFilters, remTranspFilters, transportadorasLookup]);

  // ─── Filter remove handlers ───
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
  const handleRemoveRemFilter = (key: string, value?: string) => {
    if (key === "status") setRemStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "transportadora") setRemTranspFilters(prev => prev.filter(v => v !== value));
  };

  // ─── Status updates (invalidate query for fresh data after update) ───
  const updateEntregaStatus = async (entrega: Entrega, status: string) => {
    if (!canEdit) return;
    const { data: remessas, error: remessasError } = await supabase
      .from("remessas")
      .select("id")
      .eq("ordem_venda_id", entrega.id)
      .eq("ativo", true);
    if (remessasError) {
      toast.error(getUserFriendlyError(remessasError));
      return;
    }
    const remessaIds = (remessas ?? []).map((r) => r.id);
    if (remessaIds.length === 0) { toast.warning("Nenhuma remessa encontrada para o pedido."); return; }
    if (remessaIds.length > 1) {
      toast.warning("Este pedido possui múltiplas remessas. Atualize status por remessa na aba Remessas.");
      return;
    }
    const { error } = await supabase.from("remessas").update({ status_transporte: status }).eq("id", remessaIds[0]);
    if (error) { toast.error(getUserFriendlyError(error)); return; }
    toast.success("Status atualizado");
  };

  const updateRecebimentoStatus = async (recebimento: Recebimento, status: string) => {
    if (!canEdit) return;
    // Guard: only allow transitions that are valid in the Compras domain.
    // Writing an arbitrary logistic status (e.g. "em_transito") to pedidos_compra.status
    // would corrupt the purchasing workflow.  Only "recebido" is safe to propagate here.
    const ALLOWED_FROM_LOGISTICA = ["recebido"];
    if (!ALLOWED_FROM_LOGISTICA.includes(status)) {
      toast.warning("Esta transição deve ser feita no módulo de Compras.");
      return;
    }
    // Only set data_entrega_real; do not overwrite the Compras status lifecycle.
    const { error } = await supabase
      .from("pedidos_compra")
      .update({ data_entrega_real: new Date().toISOString().slice(0, 10) })
      .eq("id", recebimento.id);
    if (error) { toast.error(getUserFriendlyError(error)); return; }
    toast.success("Data de recebimento registrada. A consolidação quantitativa permanece no módulo Compras.");
  };

  const openViewRemessa = (r: Remessa) => { setRemSelected(r); setRemDrawerOpen(true); };

  const handleAddEvento = async () => {
    if (!remSelected || !eventoForm.descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    setSavingEvento(true);
    try {
      const { error } = await supabase.from("remessa_eventos").insert({ remessa_id: remSelected.id, descricao: eventoForm.descricao, local: eventoForm.local || null });
      if (error) throw error;
      toast.success("Evento adicionado");
      setEventoForm({ descricao: "", local: "" });
      const { data: d } = await supabase.from("remessa_eventos").select("*").eq("remessa_id", remSelected.id).order("data_hora", { ascending: false });
      setEventos((d ?? []) as RemessaEvento[]);
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    } finally { setSavingEvento(false); }
  };

  const handleRemessaStatusChange = async (remessa: Remessa, newStatus: string) => {
    try {
      await updateRemessa(remessa.id, { status_transporte: newStatus });
      if (remSelected?.id === remessa.id) setRemSelected({ ...remessa, status_transporte: newStatus });
      toast.success(`Status atualizado para ${remessaStatusMap[newStatus]?.label ?? newStatus}`);
    } catch (err: unknown) { toast.error(getUserFriendlyError(err)); }
  };

  const handleRastrear = async (remessa: Remessa) => {
    if (!remessa.codigo_rastreio) { toast.error("Sem código de rastreio"); return; }
    setIsMockTracking(false);
    try {
      toast.info("Consultando rastreio...");
      const { novos, isMock, eventos: evs } = await trackAndPersistEventos(
        remessa.codigo_rastreio,
        remessa.id,
      );
      setIsMockTracking(isMock);

      if (isMock) {
        toast.warning("Dados simulados — credenciais dos Correios não configuradas.");
        setEventos(evs as unknown as RemessaEvento[]);
        return;
      }

      toast.success(`${novos} novo(s) evento(s) incluído(s)`);
      const { data: updatedEvents } = await supabase
        .from("remessa_eventos").select("*").eq("remessa_id", remessa.id)
        .order("data_hora", { ascending: false });
      setEventos((updatedEvents ?? []) as RemessaEvento[]);
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const [bulkTracking, setBulkTracking] = useState(false);
  const handleBulkRastrear = async () => {
    const rastreiaveis = (remessasData as Remessa[]).filter(
      (r) => r.codigo_rastreio && !["entregue", "cancelado", "devolvido"].includes(r.status_transporte || "")
    );
    if (rastreiaveis.length === 0) { toast.info("Nenhuma remessa com rastreio pendente"); return; }
    setBulkTracking(true);
    let updated = 0;
    for (const r of rastreiaveis) {
      try { await handleRastrear(r); updated++; } catch { /* skip */ }
    }
    setBulkTracking(false);
    toast.success(`${updated} remessa(s) atualizada(s)`);
  };

  const transportadoraOptions: MultiSelectOption[] = transportadorasList.map((t) => ({ label: t, value: t }));
  const fornecedorOptions: MultiSelectOption[] = fornecedoresList.map((f) => ({ label: f, value: f }));
  const remStatusOptions: MultiSelectOption[] = Object.entries(remessaStatusMap).map(([k, v]) => ({ label: v.label, value: k }));
  const remTranspOptions: MultiSelectOption[] = transportadorasLookup.map(t => ({ label: t.nome_razao_social, value: t.id }));

  // ─── Columns ───
  const entregaColumns = [
    { key: "numero_pedido", label: "Pedido", sortable: true, render: (item: Entrega) => (
      <div className="inline-flex flex-col items-start gap-0.5">
        <span className="font-mono text-xs font-semibold text-primary">{item.numero_pedido}</span>
        {item.exibicao_remessas === "multipla" && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {item.remessas_count} remessas
          </Badge>
        )}
      </div>
    ) },
    { key: "cliente", label: "Cliente", sortable: true, render: (item: Entrega) => <span className="font-medium text-sm">{item.cliente}</span> },
    { key: "transportadora", label: "Transportadora", render: (item: Entrega) => item.transportadora === "—" ? <span className="text-muted-foreground text-xs">—</span> : <span className="text-sm">{item.transportadora}</span> },
    { key: "status_logistico", label: "Status", sortable: true, render: (item: Entrega) => {
      const cfg = getEntregaStatusCfg(item.status_logistico);
      const atrasado = isAtrasadoEntrega(item);
      return (<span className="inline-flex flex-col items-start gap-0.5"><StatusBadge status={cfg.badgeStatus} label={cfg.label} />{atrasado && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="h-2.5 w-2.5" />Atrasada</Badge>}</span>);
    }},
    { key: "previsao_entrega", label: "Prev. Entrega", render: (item: Entrega) => {
      if (!item.previsao_entrega) return <span className="text-muted-foreground text-xs">—</span>;
      const atrasado = isAtrasadoEntrega(item);
      return <span className={`text-xs ${atrasado ? "text-destructive font-medium" : ""}`}>{formatDate(item.previsao_entrega)}</span>;
    }},
    { key: "data_expedicao", label: "Expedição", render: (item: Entrega) => item.data_expedicao ? <span className="text-xs">{formatDate(item.data_expedicao)}</span> : <span className="text-muted-foreground text-xs">—</span> },
    { key: "cidade_uf", label: "Cidade/UF", hidden: true, render: (item: Entrega) => <span className="text-xs">{item.cidade_uf}</span> },
    { key: "volumes", label: "Volumes", hidden: true, render: (item: Entrega) => <span className="text-xs">{formatNumber(item.volumes || 0)}</span> },
    { key: "peso_total", label: "Peso", hidden: true, render: (item: Entrega) => <span className="text-xs">{formatNumber(item.peso_total || 0)} kg</span> },
    { key: "previsao_envio", label: "Prev. Envio", hidden: true, render: (item: Entrega) => item.previsao_envio ? <span className="text-xs">{formatDate(item.previsao_envio)}</span> : <span className="text-muted-foreground text-xs">—</span> },
    { key: "codigo_rastreio", label: "Rastreio", hidden: true, render: (item: Entrega) => item.codigo_rastreio ? <span className="font-mono text-xs">{item.codigo_rastreio}</span> : <span className="text-muted-foreground text-xs">—</span> },
    { key: "acoes", label: "Ações", render: (item: Entrega) => (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedEntrega(item)}><Eye className="h-3.5 w-3.5" />Ver</Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => pushView("ordem_venda", item.id)}><ExternalLink className="h-3.5 w-3.5" />Pedido</Button>
        {canEdit && (
          <Select value={item.status_logistico} onValueChange={(value) => updateEntregaStatus(item, value)}>
            <SelectTrigger className="h-8 w-[180px] text-xs" disabled={item.exibicao_remessas === "multipla"}><SelectValue /></SelectTrigger>
            <SelectContent>{entregaStatusOptions.map((s) => <SelectItem key={s} value={s}>{logisticaStatusMap[s]?.label || s.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {item.exibicao_remessas === "multipla" && (
          <span className="text-[10px] text-muted-foreground">Atualize por remessa (aba Remessas)</span>
        )}
      </div>
    )},
  ];

  const recebimentosColumns = [
    { key: "numero_compra", label: "Compra", sortable: true, render: (item: Recebimento) => <span className="font-mono text-xs font-semibold text-primary">{item.numero_compra}</span> },
    { key: "fornecedor", label: "Fornecedor", render: (item: Recebimento) => <span className="font-medium text-sm">{item.fornecedor}</span> },
    { key: "status_logistico", label: "Status", sortable: true, render: (item: Recebimento) => {
      const cfg = getRecebimentoStatusCfg(item.status_logistico);
      const atrasado = isAtrasadoRecebimento(item);
      return (<span className="inline-flex flex-col items-start gap-0.5"><StatusBadge status={cfg.badgeStatus} label={cfg.label} />{atrasado && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="h-2.5 w-2.5" />Atrasado</Badge>}</span>);
    }},
    { key: "previsao_entrega", label: "Prev. Entrega", render: (item: Recebimento) => {
      if (!item.previsao_entrega) return <span className="text-muted-foreground text-xs">—</span>;
      const atrasado = isAtrasadoRecebimento(item);
      return <span className={`text-xs ${atrasado ? "text-destructive font-medium" : ""}`}>{formatDate(item.previsao_entrega)}</span>;
    }},
    { key: "data_recebimento", label: "Recebido em", render: (item: Recebimento) => item.data_recebimento ? <span className="text-xs">{formatDate(item.data_recebimento)}</span> : <span className="text-muted-foreground text-xs">—</span> },
    { key: "quantidade_pedida", label: "Qtd. Pedida", render: (item: Recebimento) => <span className="text-xs">{formatNumber(item.quantidade_pedida)}</span> },
    { key: "quantidade_recebida", label: "Qtd. Recebida", render: (item: Recebimento) => (
      <div className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs">{formatNumber(item.quantidade_recebida)}</span>
        {!item.recebimento_real && item.status_logistico === "recebimento_parcial" && (
          <span className="text-[10px] text-muted-foreground">parcial não consolidado</span>
        )}
      </div>
    ) },
    { key: "pendencia", label: "Pendência", render: (item: Recebimento) => item.pendencia > 0 ? (
      <div className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-warning font-medium">{formatNumber(item.pendencia)}</span>
        {!item.recebimento_real && item.status_logistico === "recebimento_parcial" && (
          <span className="text-[10px] text-muted-foreground">depende do módulo Compras</span>
        )}
      </div>
    ) : <span className="text-xs text-muted-foreground">—</span> },
    { key: "acoes", label: "Ações", render: (item: Recebimento) => (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedRecebimento(item)}><Eye className="h-3.5 w-3.5" />Ver</Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => pushView("pedido_compra", item.id)}><ExternalLink className="h-3.5 w-3.5" />Compra</Button>
        {canEdit && item.status_logistico !== "recebido" && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => updateRecebimentoStatus(item, "recebido")}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" />Marcar Recebido
          </Button>
        )}
      </div>
    )},
  ];

  const remessaColumns = [
    { key: "codigo_rastreio", label: "Rastreio", render: (r: Remessa) => <span className="font-mono text-xs">{r.codigo_rastreio || "—"}</span> },
    { key: "cliente_id", label: "Cliente", render: (r: Remessa) => clienteMapLookup[r.cliente_id ?? ""] ?? "—" },
    { key: "transportadora_id", label: "Transportadora", render: (r: Remessa) => transpMapLookup[r.transportadora_id ?? ""] ?? "—" },
    { key: "data_postagem", label: "Postagem", render: (r: Remessa) => r.data_postagem ? format(new Date(r.data_postagem + "T00:00:00"), "dd/MM/yyyy") : "—" },
    { key: "status_transporte", label: "Status", render: (r: Remessa) => {
      const s = r.status_transporte ?? "";
      return <StatusBadge status={remessaStatusMap[s]?.color ?? s} />;
    }},
  ];

  const remSummaryItems = remSelected ? [
    { label: "Status", value: remessaStatusMap[remSelected.status_transporte ?? ""]?.label ?? remSelected.status_transporte ?? "—" },
    { label: "Volumes", value: String(remSelected.volumes ?? 1) },
    { label: "Peso", value: remSelected.peso ? `${remSelected.peso} kg` : "—" },
    { label: "Frete", value: remSelected.valor_frete ? `R$ ${Number(remSelected.valor_frete).toFixed(2)}` : "—" },
  ] : [];

  return (
    <AppLayout>
      <ModulePage
        title="Logística"
        subtitle="Central de acompanhamento logístico, entregas, recebimentos e remessas."
        addLabel={canEdit ? "Nova Remessa" : undefined}
        onAdd={canEdit ? () => navigate("/remessas/new") : undefined}
        headerActions={canEdit ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkRastrear} disabled={bulkTracking}>
            {bulkTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Atualizar Rastreios
          </Button>
        ) : undefined}
      >
        {!canEdit && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
            Seu acesso em Logística está em modo de visualização.
          </div>
        )}

        <Tabs defaultValue="entregas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
            <TabsTrigger value="remessas">Remessas</TabsTrigger>
          </TabsList>

          {/* ── Tab: Entregas ── */}
          <TabsContent value="entregas">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <SummaryCard title="Total de Entregas" value={formatNumber(entregasKpis.total)} icon={Package} variationType="neutral" variation="operações ativas" />
              <SummaryCard title="Em Transporte" value={formatNumber(entregasKpis.emTransporte)} icon={Truck} variationType="positive" variation="a caminho do cliente" />
              <SummaryCard title="Atrasadas" value={formatNumber(entregasKpis.atrasadas)} icon={AlertTriangle} variationType={entregasKpis.atrasadas > 0 ? "negative" : "neutral"} variation="fora do prazo" />
              <SummaryCard title="Entregues" value={formatNumber(entregasKpis.entregues)} icon={CheckCheck} variationType="positive" variation="concluídas" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <SummaryCard
                title="% Entregas no Prazo"
                value={entregasKpis.percentualNoPrazo !== null ? `${entregasKpis.percentualNoPrazo}%` : "—"}
                icon={CheckCheck}
                variationType={
                  entregasKpis.percentualNoPrazo === null
                    ? "neutral"
                    : entregasKpis.percentualNoPrazo >= 90
                    ? "positive"
                    : entregasKpis.percentualNoPrazo >= 70
                    ? "neutral"
                    : "negative"
                }
                variation="das entregas concluídas"
              />
              <SummaryCard
                title="Tempo Médio de Entrega"
                value={entregasKpis.tempoMedioDias !== null ? `${entregasKpis.tempoMedioDias} dias` : "—"}
                icon={Timer}
                variationType="neutral"
                variation="expedição → entrega prevista"
              />
              <SummaryCard
                title="Pendentes de Expedição"
                value={formatNumber(
                  entregas.filter((e) =>
                    ["aguardando_separacao", "em_separacao", "separado", "aguardando_expedicao"].includes(
                      e.status_logistico,
                    ),
                  ).length,
                )}
                icon={Clock}
                variationType="neutral"
                variation="aguardando saída"
              />
            </div>
            <AdvancedFilterBar searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Buscar por pedido, cliente, transportadora ou rastreio..." activeFilters={activeEntregaFilters} onRemoveFilter={handleRemoveEntregaFilter} onClearAll={() => { setStatusFilters([]); setTransportadoraFilters([]); setPrazoFilters([]); setDataInicio(""); setDataFim(""); }} count={filteredEntregas.length}>
              <MultiSelect options={entregaStatusMultiOptions} selected={statusFilters} onChange={setStatusFilters} placeholder="Status" className="w-[180px]" />
              <MultiSelect options={transportadoraOptions} selected={transportadoraFilters} onChange={setTransportadoraFilters} placeholder="Transportadora" className="w-[200px]" />
              <MultiSelect options={prazoOptions} selected={prazoFilters} onChange={setPrazoFilters} placeholder="Prazo" className="w-[160px]" />
              <div className="flex items-center gap-2">
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 w-[140px] text-xs" title="Prev. entrega desde" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 w-[140px] text-xs" title="Prev. entrega até" />
              </div>
            </AdvancedFilterBar>
            <DataTable columns={entregaColumns} data={filteredEntregas} loading={loading} moduleKey="logistica-entregas" showColumnToggle emptyTitle="Nenhuma entrega encontrada" emptyDescription="Tente ajustar os filtros de status ou período." />
          </TabsContent>

          {/* ── Tab: Recebimentos ── */}
          <TabsContent value="recebimentos">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard title="Total de Recebimentos" value={formatNumber(recebimentosKpis.total)} icon={Package} variationType="neutral" variation="pedidos de compra" />
              <SummaryCard title="Em Trânsito" value={formatNumber(recebimentosKpis.emTransito)} icon={Truck} variationType="positive" variation="a caminho do armazém" />
              <SummaryCard title="Atrasados" value={formatNumber(recebimentosKpis.atrasados)} icon={AlertTriangle} variationType={recebimentosKpis.atrasados > 0 ? "negative" : "neutral"} variation="fora do prazo" />
              <SummaryCard title="Recebidos" value={formatNumber(recebimentosKpis.recebidos)} icon={CheckCheck} variationType="positive" variation="concluídos" />
            </div>
            <AdvancedFilterBar searchValue={searchTermReceb} onSearchChange={setSearchTermReceb} searchPlaceholder="Buscar por número da compra ou fornecedor..." activeFilters={activeRecebimentoFilters} onRemoveFilter={handleRemoveRecebimentoFilter} onClearAll={() => { setStatusFiltersReceb([]); setFornecedorFilters([]); setPrazoFiltersReceb([]); setDataInicioReceb(""); setDataFimReceb(""); }} count={filteredRecebimentos.length}>
              <MultiSelect options={recebimentoStatusMultiOptions} selected={statusFiltersReceb} onChange={setStatusFiltersReceb} placeholder="Status" className="w-[180px]" />
              <MultiSelect options={fornecedorOptions} selected={fornecedorFilters} onChange={setFornecedorFilters} placeholder="Fornecedor" className="w-[200px]" />
              <MultiSelect options={prazoOptionsReceb} selected={prazoFiltersReceb} onChange={setPrazoFiltersReceb} placeholder="Prazo" className="w-[160px]" />
              <div className="flex items-center gap-2">
                <Input type="date" value={dataInicioReceb} onChange={(e) => setDataInicioReceb(e.target.value)} className="h-9 w-[140px] text-xs" title="Prev. entrega desde" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="date" value={dataFimReceb} onChange={(e) => setDataFimReceb(e.target.value)} className="h-9 w-[140px] text-xs" title="Prev. entrega até" />
              </div>
            </AdvancedFilterBar>
            <DataTable columns={recebimentosColumns} data={filteredRecebimentos} loading={loading} moduleKey="logistica-recebimentos" showColumnToggle emptyTitle="Nenhum recebimento encontrado" emptyDescription="Tente ajustar os filtros de status ou período." />
          </TabsContent>

          {/* ── Tab: Remessas ── */}
          <TabsContent value="remessas">
            <AdvancedFilterBar searchValue={remSearchTerm} onSearchChange={setRemSearchTerm} searchPlaceholder="Buscar por rastreio, cliente ou transportadora..." activeFilters={remActiveFilters} onRemoveFilter={handleRemoveRemFilter} onClearAll={() => { setRemStatusFilters([]); setRemTranspFilters([]); }} count={filteredRemessas.length}>
              <MultiSelect options={remStatusOptions} selected={remStatusFilters} onChange={setRemStatusFilters} placeholder="Status" className="w-[180px]" />
              <MultiSelect options={remTranspOptions} selected={remTranspFilters} onChange={setRemTranspFilters} placeholder="Transportadoras" className="w-[220px]" />
            </AdvancedFilterBar>
            <DataTable columns={remessaColumns} data={filteredRemessas} loading={remessasLoading} onView={openViewRemessa} onEdit={(r) => navigate(`/remessas/${r.id}`)} emptyTitle="Nenhuma remessa encontrada" emptyDescription="Tente ajustar os filtros ou crie uma nova remessa." />
          </TabsContent>
        </Tabs>
      </ModulePage>

      {/* Entrega Drawer */}
      <EntregaDrawer open={!!selectedEntrega} onClose={() => setSelectedEntrega(null)} entrega={selectedEntrega} />

      {/* Recebimento Drawer */}
      <RecebimentoDrawer open={!!selectedRecebimento} onClose={() => setSelectedRecebimento(null)} recebimento={selectedRecebimento} />

      {/* Remessa Detail Drawer */}
      <ViewDrawerV2
        open={remDrawerOpen}
        onClose={() => setRemDrawerOpen(false)}
        title={remSelected?.codigo_rastreio ? `Remessa ${remSelected.codigo_rastreio}` : "Detalhes da Remessa"}
        actions={remSelected ? <>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar remessa" onClick={() => { setRemDrawerOpen(false); navigate(`/remessas/${remSelected.id}`); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir remessa" onClick={() => { setRemDrawerOpen(false); removeRemessa(remSelected.id); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
        </> : undefined}
        summary={remSelected ? (
          <div className="grid grid-cols-4 gap-3">
            {remSummaryItems.map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="font-semibold text-sm">{s.value}</p>
              </div>
            ))}
          </div>
        ) : undefined}
        tabs={[
          {
            value: "dados", label: "Dados",
            content: remSelected ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { label: "Transportadora", value: transpMapLookup[remSelected.transportadora_id || ""] },
                    { label: "Cliente", value: clienteMapLookup[remSelected.cliente_id || ""] },
                    { label: "Serviço", value: remSelected.servico },
                    { label: "Código de Rastreio", value: remSelected.codigo_rastreio, mono: true },
                    { label: "Data Postagem", value: remSelected.data_postagem ? format(new Date(remSelected.data_postagem + "T00:00:00"), "dd/MM/yyyy") : null },
                    { label: "Previsão Entrega", value: remSelected.previsao_entrega ? format(new Date(remSelected.previsao_entrega + "T00:00:00"), "dd/MM/yyyy") : null },
                    { label: "Peso", value: remSelected.peso ? `${remSelected.peso} kg` : null },
                    { label: "Volumes", value: remSelected.volumes?.toString() },
                    { label: "Valor Frete", value: remSelected.valor_frete ? `R$ ${Number(remSelected.valor_frete).toFixed(2)}` : null },
                   { label: "Ped. Compra", value: pedidosCompra.find(pc => pc.id === remSelected.pedido_compra_id)?.numero },
                    { label: "Nota Fiscal", value: notasFiscais.find(nf => nf.id === remSelected.nota_fiscal_id)?.numero },
                  ].map((f, i) => (
                    <div key={i}>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className={`text-sm ${f.mono ? "font-mono" : ""}`}>{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
                {remSelected.observacoes && (
                  <div className="border-t pt-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Observações</p>
                    <p className="text-sm text-muted-foreground">{remSelected.observacoes}</p>
                  </div>
                )}
              </div>
            ) : null,
          },
          {
            value: "eventos", label: "Eventos",
            content: remSelected ? (
              <div className="space-y-4">
                {isMockTracking && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground"><strong>Dados simulados</strong> — credenciais dos Correios não configuradas.</p>
                  </div>
                )}
                <div className="rounded-lg border bg-card p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Novo Evento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Descrição do evento *" value={eventoForm.descricao} onChange={e => setEventoForm({ ...eventoForm, descricao: e.target.value })} />
                    <Input placeholder="Local (opcional)" value={eventoForm.local} onChange={e => setEventoForm({ ...eventoForm, local: e.target.value })} />
                  </div>
                  <Button size="sm" onClick={handleAddEvento} disabled={savingEvento}><Plus className="h-3.5 w-3.5 mr-1" />{savingEvento ? "Salvando..." : "Adicionar"}</Button>
                </div>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado</p>
                ) : (
                  <div className="space-y-0">
                    {eventos.map((ev, i) => (
                      <div key={ev.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full border-2 ${i === 0 ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background"}`} />
                          {i < eventos.length - 1 && <div className="flex-1 w-px bg-border" />}
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <p className="text-sm font-medium">{ev.descricao}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{format(new Date(ev.data_hora), "dd/MM/yyyy HH:mm")}</span>
                            {ev.local && <><MapPin className="h-3 w-3" /><span>{ev.local}</span></>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null,
          },
        ]}
        footer={remSelected ? (
          <div className="flex gap-2 flex-wrap">
            {remSelected.codigo_rastreio && (
              <Button size="sm" variant="outline" onClick={() => handleRastrear(remSelected)}><Search className="h-4 w-4 mr-1" /> Rastrear Correios</Button>
            )}
            {remSelected.status_transporte !== "entregue" && (
              <>
                {remSelected.status_transporte === "pendente" && <Button size="sm" onClick={() => handleRemessaStatusChange(remSelected, "postado")}><Truck className="h-4 w-4 mr-1" /> Marcar como Postado</Button>}
                {remSelected.status_transporte === "postado" && <Button size="sm" onClick={() => handleRemessaStatusChange(remSelected, "em_transito")}><Truck className="h-4 w-4 mr-1" /> Em Trânsito</Button>}
                {(remSelected.status_transporte === "em_transito" || remSelected.status_transporte === "postado") && <Button size="sm" variant="outline" onClick={() => handleRemessaStatusChange(remSelected, "entregue")}><PackageIcon className="h-4 w-4 mr-1" /> Entregue</Button>}
                {remSelected.status_transporte !== "devolvido" && <Button size="sm" variant="destructive" onClick={() => handleRemessaStatusChange(remSelected, "devolvido")}>Devolvido</Button>}
              </>
            )}
          </div>
        ) : undefined}
      />
    </AppLayout>
  );
}
