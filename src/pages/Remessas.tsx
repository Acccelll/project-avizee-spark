import { useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { FormModal } from "@/components/FormModal";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2, Plus, MapPin, Package as PackageIcon, Truck, Search, AlertTriangle } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { toast } from "sonner";
import { format } from "date-fns";

type Remessa = Tables<"remessas">;
type RemessaEvento = Tables<"remessa_eventos">;

/** Shape of a single event object returned by the Correios tracking API. */
interface CorreiosEvento {
  descricao?: string;
  tipo?: string;
  unidade?: { nome?: string; endereco?: { cidade?: string } };
  dtHrCriado?: string;
}

/** Top-level response shape from the Correios tracking endpoint. */
interface CorreiosTrackingResponse {
  error?: string;
  objetos?: Array<{ eventos?: CorreiosEvento[] }>;
  /** "fallback_mock" when the Edge Function fell back to mock data. */
  warning?: string;
  /** Present in fallback mode — contains mock track data. */
  data?: { eventos?: CorreiosEvento[] };
}

import { statusRemessa } from "@/lib/statusSchema";

const statusMap: Record<string, { label: string; color: string }> = {
  ...statusRemessa,
  postado: { label: "Postado", color: "info" },
};

interface RemessaForm {
  cliente_id: string; transportadora_id: string; servico: string; codigo_rastreio: string;
  data_postagem: string; previsao_entrega: string; status_transporte: string;
  peso: string; volumes: string; valor_frete: string; observacoes: string;
  ordem_venda_id: string; pedido_compra_id: string; nota_fiscal_id: string;
}

const emptyForm: RemessaForm = {
  cliente_id: "", transportadora_id: "", servico: "", codigo_rastreio: "",
  data_postagem: "", previsao_entrega: "", status_transporte: "pendente",
  peso: "", volumes: "1", valor_frete: "", observacoes: "",
  ordem_venda_id: "", pedido_compra_id: "", nota_fiscal_id: "",
};

export default function Remessas() {
  const { data, loading, create, update, remove } = useSupabaseCrud<Remessa>({ table: "remessas" });
  const { pushView } = useRelationalNavigation();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Remessa | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [transportadoraFilters, setTransportadoraFilters] = useState<string[]>([]);

  const [clientes, setClientes] = useState<Array<{ id: string; nome_razao_social: string }>>([]);
  const [transportadoras, setTransportadoras] = useState<Array<{ id: string; nome_razao_social: string }>>([]);
  const [ordensVenda, setOrdensVenda] = useState<any[]>([]);
  const [pedidosCompra, setPedidosCompra] = useState<any[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<any[]>([]);
  const [eventos, setEventos] = useState<RemessaEvento[]>([]);
  const [eventoForm, setEventoForm] = useState({ descricao: "", local: "" });
  const [savingEvento, setSavingEvento] = useState(false);
  const [isMockTracking, setIsMockTracking] = useState(false);

  useEffect(() => {
    supabase.from("clientes").select("id,nome_razao_social").eq("ativo", true).then(({ data }) => setClientes(data || []));
    supabase.from("transportadoras").select("id,nome_razao_social").eq("ativo", true).then(({ data }) => setTransportadoras(data || []));
    supabase.from("ordens_venda").select("id, numero").eq("ativo", true).then(({ data }) => setOrdensVenda(data || []));
    supabase.from("pedidos_compra").select("id, numero").eq("ativo", true).then(({ data }) => setPedidosCompra(data || []));
    supabase.from("notas_fiscais").select("id, numero, tipo").eq("ativo", true).then(({ data }) => setNotasFiscais(data || []));
  }, []);

  useEffect(() => {
    if (selected && drawerOpen) {
      supabase.from("remessa_eventos").select("*").eq("remessa_id", selected.id).order("data_hora", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error("[remessas] erro ao carregar eventos:", error);
            toast.error("Erro ao carregar histórico de eventos");
            return;
          }
          setEventos(data || []);
        });
    }
  }, [selected, drawerOpen]);

  const clienteMap = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c.nome_razao_social])), [clientes]);
  const transportadoraMap = useMemo(() => Object.fromEntries(transportadoras.map(t => [t.id, t.nome_razao_social])), [transportadoras]);

  const openCreate = () => { setMode("create"); setForm({ ...emptyForm }); setSelected(null); setModalOpen(true); };
  const openEdit = (r: Remessa) => {
    setMode("edit"); setSelected(r);
    setForm({
      cliente_id: r.cliente_id || "", transportadora_id: r.transportadora_id || "",
      servico: r.servico || "", codigo_rastreio: r.codigo_rastreio || "",
      data_postagem: r.data_postagem || "", previsao_entrega: r.previsao_entrega || "",
      status_transporte: r.status_transporte, peso: r.peso?.toString() || "",
      volumes: r.volumes?.toString() || "1", valor_frete: r.valor_frete?.toString() || "",
      observacoes: r.observacoes || "", ordem_venda_id: r.ordem_venda_id || "",
      pedido_compra_id: (r as any).pedido_compra_id || "",
      nota_fiscal_id: (r as any).nota_fiscal_id || "",
    });
    setModalOpen(true);
  };
  const openView = (r: Remessa) => {
    setSelected(r);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.transportadora_id) { toast.error("Transportadora é obrigatória"); return; }
    setSaving(true);
    const payload = {
      ...form,
      peso: form.peso ? Number(form.peso) : null,
      volumes: form.volumes ? Number(form.volumes) : 1,
      valor_frete: form.valor_frete ? Number(form.valor_frete) : null,
      cliente_id: form.cliente_id || null,
      transportadora_id: form.transportadora_id || null,
      ordem_venda_id: form.ordem_venda_id || null,
      pedido_compra_id: (form as any).pedido_compra_id || null,
      nota_fiscal_id: (form as any).nota_fiscal_id || null,
      data_postagem: form.data_postagem || null,
      previsao_entrega: form.previsao_entrega || null,
    };
    try {
      if (mode === "create") await create(payload);
      else if (selected) await update(selected.id, payload);
      setModalOpen(false);
    } catch (err: unknown) {
      console.error("[remessas] handleSubmit:", err);
    }
    setSaving(false);
  };

  const handleAddEvento = async () => {
    if (!selected || !eventoForm.descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    setSavingEvento(true);
    try {
      const { error } = await supabase.from("remessa_eventos").insert({
        remessa_id: selected.id,
        descricao: eventoForm.descricao,
        local: eventoForm.local || null,
      });

      if (error) throw error;

      toast.success("Evento adicionado");
      setEventoForm({ descricao: "", local: "" });

      const { data, error: fetchError } = await supabase
        .from("remessa_eventos")
        .select("*")
        .eq("remessa_id", selected.id)
        .order("data_hora", { ascending: false });

      if (fetchError) throw fetchError;
      setEventos(data || []);
    } catch (err: any) {
      console.error("[remessas] handleAddEvento:", err);
      toast.error("Erro ao salvar evento: " + (err.message || "Tente novamente"));
    } finally {
      setSavingEvento(false);
    }
  };

  const handleStatusChange = async (remessa: Remessa, newStatus: string) => {
    try {
      await update(remessa.id, { status_transporte: newStatus });
      if (selected?.id === remessa.id) setSelected({ ...remessa, status_transporte: newStatus });
      toast.success(`Status atualizado para ${statusMap[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      console.error("[remessas] handleStatusChange:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleRastrear = async (remessa: Remessa) => {
    if (!remessa.codigo_rastreio) { toast.error("Sem código de rastreio"); return; }
    const codigoSanitizado = remessa.codigo_rastreio.trim().toUpperCase().replace(/\s+/g, "");
    if (!codigoSanitizado) { toast.error("Código de rastreio inválido"); return; }
    setIsMockTracking(false);
    try {
      toast.info("Consultando rastreio...");
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || "").replace(/\/$/, "");
      const url = `${supabaseUrl}/functions/v1/correios-api?action=rastrear&codigo=${encodeURIComponent(codigoSanitizado)}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          Authorization: `Bearer ${token}`,
        },
      });
      const tracking = await res.json() as CorreiosTrackingResponse;
      if (!res.ok || tracking.error) {
        throw new Error(tracking.error || `Erro ao consultar rastreio (${res.status})`);
      }

      const isMock = tracking.warning === "fallback_mock";
      setIsMockTracking(isMock);

      // Normalise events from both real and mock response shapes
      const rawEventos: CorreiosEvento[] = isMock
        ? (tracking.data?.eventos || [])
        : (tracking.objetos?.[0]?.eventos || []);

      const eventosNormalizados = rawEventos.map((ev) => ({
        remessa_id: remessa.id,
        descricao: ev.descricao || ev.tipo || "Evento",
        local: ev.unidade?.endereco?.cidade || ev.unidade?.nome || null,
        data_hora: ev.dtHrCriado || new Date().toISOString(),
      }));

      if (isMock) {
        // Mock data is shown inline only — not persisted
        toast.warning("Dados simulados — credenciais dos Correios não configuradas. Eventos não foram persistidos.");
        setEventos(eventosNormalizados as unknown as RemessaEvento[]);
        return;
      }

      const { data: eventosExistentes, error: eventosExistentesError } = await supabase
        .from("remessa_eventos")
        .select("descricao, local, data_hora")
        .eq("remessa_id", remessa.id);

      if (eventosExistentesError) {
        throw eventosExistentesError;
      }

      const eventKey = (evento: { descricao: string; local: string | null; data_hora: string }) =>
        `${evento.data_hora}::${evento.descricao}::${evento.local || ""}`;

      const eventosExistentesSet = new Set(
        (eventosExistentes || []).map((evento) => eventKey(evento))
      );

      const novosEventos = eventosNormalizados.filter(
        (evento) => !eventosExistentesSet.has(eventKey(evento))
      );

      if (novosEventos.length > 0) {
        const { error: insertError } = await supabase.from("remessa_eventos").insert(novosEventos);
        if (insertError) {
          throw insertError;
        }
      }

      toast.success(`${novosEventos.length} novo(s) evento(s) incluído(s)`);
      const { data: updatedEvents, error: updatedEventsError } = await supabase
        .from("remessa_eventos")
        .select("*")
        .eq("remessa_id", remessa.id)
        .order("data_hora", { ascending: false });

      if (updatedEventsError) {
        throw updatedEventsError;
      }

      setEventos(updatedEvents || []);
    } catch (err: unknown) {
      console.error("[rastrear]", err);
      toast.error(err instanceof Error ? err.message : "Erro ao consultar rastreio");
    }
  };

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.filter(r => {
      if (statusFilters.length > 0 && !statusFilters.includes(r.status_transporte)) return false;
      if (transportadoraFilters.length > 0 && !transportadoraFilters.includes(r.transportadora_id || "")) return false;

      if (!q) return true;
      return [r.codigo_rastreio, clienteMap[r.cliente_id || ""], transportadoraMap[r.transportadora_id || ""]].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, searchTerm, clienteMap, transportadoraMap, statusFilters, transportadoraFilters]);

  const remActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach(f => chips.push({ key: "status", label: "Status", value: [f], displayValue: statusMap[f]?.label || f }));
    transportadoraFilters.forEach(f => {
      const t = transportadoras.find(x => x.id === f);
      chips.push({ key: "transportadora", label: "Transportadora", value: [f], displayValue: t?.nome_razao_social || f });
    });
    return chips;
  }, [statusFilters, transportadoraFilters, transportadoras]);

  const handleRemoveRemFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "transportadora") setTransportadoraFilters(prev => prev.filter(v => v !== value));
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusMap).map(([k, v]) => ({ label: v.label, value: k }));
  const transportadoraOptions: MultiSelectOption[] = transportadoras.map(t => ({ label: t.nome_razao_social, value: t.id }));

  const columns = [
    { key: "codigo_rastreio", label: "Rastreio", render: (r: Remessa) => <span className="font-mono text-xs">{r.codigo_rastreio || "—"}</span> },
    { key: "cliente_id", label: "Cliente", render: (r: Remessa) => clienteMap[r.cliente_id || ""] || "—" },
    { key: "transportadora_id", label: "Transportadora", render: (r: Remessa) => transportadoraMap[r.transportadora_id || ""] || "—" },
    { key: "data_postagem", label: "Postagem", render: (r: Remessa) => r.data_postagem ? format(new Date(r.data_postagem + "T00:00:00"), "dd/MM/yyyy") : "—" },
    { key: "status_transporte", label: "Status", render: (r: Remessa) => <StatusBadge status={statusMap[r.status_transporte]?.color || r.status_transporte} /> },
  ];

  const summaryItems = selected ? [
    { label: "Status", value: statusMap[selected.status_transporte]?.label || selected.status_transporte },
    { label: "Volumes", value: String(selected.volumes || 1) },
    { label: "Peso", value: selected.peso ? `${selected.peso} kg` : "—" },
    { label: "Frete", value: selected.valor_frete ? `R$ ${Number(selected.valor_frete).toFixed(2)}` : "—" },
  ] : [];

  return (
    <AppLayout>
      <ModulePage title="Remessas" subtitle="Gestão de remessas e rastreamento logístico" addLabel="Nova Remessa" onAdd={openCreate}>
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por rastreio, cliente ou transportadora..."
          activeFilters={remActiveFilters}
          onRemoveFilter={handleRemoveRemFilter}
          onClearAll={() => { setStatusFilters([]); setTransportadoraFilters([]); }}
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
            options={transportadoraOptions}
            selected={transportadoraFilters}
            onChange={setTransportadoraFilters}
            placeholder="Transportadoras"
            className="w-[220px]"
          />
        </AdvancedFilterBar>
        <DataTable columns={columns} data={filteredData} loading={loading} onView={openView} onEdit={openEdit} />
      </ModulePage>

      {/* Form Modal */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Nova Remessa" : "Editar Remessa"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Transportadora *</Label>
              <Select value={form.transportadora_id} onValueChange={v => setForm({ ...form, transportadora_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {transportadoras.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={v => setForm({ ...form, cliente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Serviço</Label><Input value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} placeholder="Ex: SEDEX, PAC..." /></div>
            <div className="space-y-2"><Label>Código de Rastreio</Label><Input value={form.codigo_rastreio} onChange={e => setForm({ ...form, codigo_rastreio: e.target.value.toUpperCase() })} placeholder="Ex: BR123456789BR" /></div>
            <div className="space-y-2"><Label>Data de Postagem</Label><Input type="date" value={form.data_postagem} onChange={e => setForm({ ...form, data_postagem: e.target.value })} /></div>
            <div className="space-y-2"><Label>Previsão de Entrega</Label><Input type="date" value={form.previsao_entrega} onChange={e => setForm({ ...form, previsao_entrega: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status_transporte} onValueChange={v => setForm({ ...form, status_transporte: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" step="0.01" value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} /></div>
            <div className="space-y-2"><Label>Volumes</Label><Input type="number" min="1" value={form.volumes} onChange={e => setForm({ ...form, volumes: e.target.value })} /></div>
            <div className="space-y-2"><Label>Valor do Frete (R$)</Label><Input type="number" step="0.01" value={form.valor_frete} onChange={e => setForm({ ...form, valor_frete: e.target.value })} /></div>
          </div>

          <h4 className="font-semibold text-sm pt-2 border-t">Vínculos Operacionais</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Pedido</Label>
              <Select value={form.ordem_venda_id} onValueChange={v => setForm({ ...form, ordem_venda_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {ordensVenda.map(ov => <SelectItem key={ov.id} value={ov.id}>{ov.numero}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pedido de Compra</Label>
              <Select value={form.pedido_compra_id} onValueChange={v => setForm({ ...form, pedido_compra_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {pedidosCompra.map(pc => <SelectItem key={pc.id} value={pc.id}>{pc.numero}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nota Fiscal</Label>
              <Select value={form.nota_fiscal_id} onValueChange={v => setForm({ ...form, nota_fiscal_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {notasFiscais.map(nf => <SelectItem key={nf.id} value={nf.id}>{nf.numero} ({nf.tipo === 'entrada' ? 'Entr.' : 'Saída'})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

      {/* Detail Drawer */}
      <ViewDrawerV2
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.codigo_rastreio ? `Remessa ${selected.codigo_rastreio}` : "Detalhes da Remessa"}
        actions={selected ? <>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDrawerOpen(false); remove(selected.id); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
        </> : undefined}
        summary={selected ? (
          <div className="grid grid-cols-4 gap-3">
            {summaryItems.map((s, i) => (
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
            content: selected ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { label: "Transportadora", value: transportadoraMap[selected.transportadora_id || ""] },
                    { label: "Cliente", value: clienteMap[selected.cliente_id || ""] },
                    { label: "Serviço", value: selected.servico },
                    { label: "Código de Rastreio", value: selected.codigo_rastreio, mono: true },
                    { label: "Data Postagem", value: selected.data_postagem ? format(new Date(selected.data_postagem + "T00:00:00"), "dd/MM/yyyy") : null },
                    { label: "Previsão Entrega", value: selected.previsao_entrega ? format(new Date(selected.previsao_entrega + "T00:00:00"), "dd/MM/yyyy") : null },
                    { label: "Peso", value: selected.peso ? `${selected.peso} kg` : null },
                    { label: "Volumes", value: selected.volumes?.toString() },
                    { label: "Valor Frete", value: selected.valor_frete ? `R$ ${Number(selected.valor_frete).toFixed(2)}` : null },
                    { label: "Ped. Compra", value: pedidosCompra.find(pc => pc.id === (selected as any).pedido_compra_id)?.numero },
                    { label: "Nota Fiscal", value: notasFiscais.find(nf => nf.id === (selected as any).nota_fiscal_id)?.numero },
                  ].map((f, i) => (
                    <div key={i}>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className={`text-sm ${f.mono ? "font-mono" : ""}`}>{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
                {selected.observacoes && (
                  <div className="border-t pt-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Observações</p>
                    <p className="text-sm text-muted-foreground">{selected.observacoes}</p>
                  </div>
                )}
              </div>
            ) : null,
          },
          {
            value: "eventos", label: "Eventos",
            content: selected ? (
              <div className="space-y-4">
                {isMockTracking && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      <strong>Dados simulados</strong> — credenciais dos Correios não estão configuradas. Os eventos abaixo são fictícios e não foram persistidos no banco de dados.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border bg-card p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Novo Evento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Descrição do evento *" value={eventoForm.descricao} onChange={e => setEventoForm({ ...eventoForm, descricao: e.target.value })} />
                    <Input placeholder="Local (opcional)" value={eventoForm.local} onChange={e => setEventoForm({ ...eventoForm, local: e.target.value })} />
                  </div>
                  <Button size="sm" onClick={handleAddEvento} disabled={savingEvento}>
                    <Plus className="h-3.5 w-3.5 mr-1" />{savingEvento ? "Salvando..." : "Adicionar"}
                  </Button>
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
        footer={selected ? (
          <div className="flex gap-2 flex-wrap">
            {selected.codigo_rastreio && (
              <Button size="sm" variant="outline" onClick={() => handleRastrear(selected)}>
                <Search className="h-4 w-4 mr-1" /> Rastrear Correios
              </Button>
            )}
            {selected.status_transporte !== "entregue" && (
              <>
                {selected.status_transporte === "pendente" && (
                  <Button size="sm" onClick={() => handleStatusChange(selected, "postado")}><Truck className="h-4 w-4 mr-1" /> Marcar como Postado</Button>
                )}
                {selected.status_transporte === "postado" && (
                  <Button size="sm" onClick={() => handleStatusChange(selected, "em_transito")}><Truck className="h-4 w-4 mr-1" /> Em Trânsito</Button>
                )}
                {(selected.status_transporte === "em_transito" || selected.status_transporte === "postado") && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(selected, "entregue")}><PackageIcon className="h-4 w-4 mr-1" /> Entregue</Button>
                )}
                {selected.status_transporte !== "devolvido" && (
                  <Button size="sm" variant="destructive" onClick={() => handleStatusChange(selected, "devolvido")}>Devolvido</Button>
                )}
              </>
            )}
          </div>
        ) : undefined}
      />
    </AppLayout>
  );
}
