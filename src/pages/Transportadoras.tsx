import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Edit, Trash2, Search, Building2, MapPin, Package, Truck, Star, AlertTriangle, Phone, FileText, Loader2, Users, UserCheck, UserX } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { useViaCep } from "@/hooks/useViaCep";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { StatCard } from "@/components/StatCard";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Transportadora {
  id: string;
  nome_razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  modalidade: string;
  prazo_medio: string;
  observacoes: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const emptyForm: Record<string, string> = {
  nome_razao_social: "", nome_fantasia: "", cpf_cnpj: "", contato: "",
  telefone: "", email: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "", cep: "", modalidade: "rodoviario",
  prazo_medio: "", observacoes: "",
};

export default function Transportadoras() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [modalidadeFilters, setModalidadeFilters] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, loading, create, update, remove } = useSupabaseCrud<Transportadora>({
    table: "transportadoras",
    searchTerm: debouncedSearch,
    searchColumns: ["nome_razao_social", "nome_fantasia", "cpf_cnpj", "cidade"],
  });
  const { pushView } = useRelationalNavigation();
  const { buscarCnpj, loading: cnpjLoading } = useCnpjLookup();
  const { buscarCep, loading: cepLoading } = useViaCep();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Transportadora | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [formAtivo, setFormAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientesVinculados, setClientesVinculados] = useState<any[]>([]);
  const [remessasVinculadas, setRemessasVinculadas] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [modalCliCount, setModalCliCount] = useState(0);
  const [modalRemCount, setModalRemCount] = useState(0);
  const [loadingModalCtx, setLoadingModalCtx] = useState(false);

  const loadModalContext = async (transportadoraId: string) => {
    setLoadingModalCtx(true);
    try {
      const [{ count: cliCount, error: cliErr }, { count: remCount, error: remErr }] = await Promise.all([
        supabase.from("cliente_transportadoras").select("id", { count: "exact", head: true }).eq("transportadora_id", transportadoraId).eq("ativo", true),
        supabase.from("remessas").select("id", { count: "exact", head: true }).eq("transportadora_id", transportadoraId),
      ]);
      if (cliErr) throw cliErr;
      if (remErr) throw remErr;
      setModalCliCount(cliCount ?? 0);
      setModalRemCount(remCount ?? 0);
    } catch (err) {
      console.error("[transportadoras] erro ao carregar contexto do modal:", err);
    } finally {
      setLoadingModalCtx(false);
    }
  };

  useEffect(() => {
    if (selected && drawerOpen) {
      supabase.from("cliente_transportadoras")
        .select("*, clientes(nome_razao_social, cpf_cnpj)")
        .eq("transportadora_id", selected.id)
        .then(({ data }) => setClientesVinculados(data || []));
      supabase.from("remessas")
        .select("id, codigo_rastreio, status_transporte, data_postagem, previsao_entrega, servico, clientes(nome_razao_social)")
        .eq("transportadora_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => setRemessasVinculadas(data || []));
    } else {
      setClientesVinculados([]);
      setRemessasVinculadas([]);
    }
  }, [selected, drawerOpen]);

  const openCreate = () => { setMode("create"); setForm({...emptyForm}); setFormAtivo(true); setSelected(null); setModalCliCount(0); setModalRemCount(0); setModalOpen(true); };
  const openEdit = (t: Transportadora) => {
    setMode("edit"); setSelected(t);
    setForm({
      nome_razao_social: t.nome_razao_social, nome_fantasia: t.nome_fantasia || "",
      cpf_cnpj: t.cpf_cnpj || "", contato: t.contato || "",
      telefone: t.telefone || "", email: t.email || "",
      logradouro: t.logradouro || "", numero: t.numero || "",
      complemento: t.complemento || "", bairro: t.bairro || "",
      cidade: t.cidade || "", uf: t.uf || "", cep: t.cep || "",
      modalidade: t.modalidade || "rodoviario",
      prazo_medio: t.prazo_medio || "", observacoes: t.observacoes || "",
    });
    setFormAtivo(t.ativo ?? true);
    setModalCliCount(0); setModalRemCount(0);
    loadModalContext(t.id);
    setModalOpen(true);
  };
  const openView = (t: Transportadora) => {
    setSelected(t);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_razao_social) { toast.error("Razão Social é obrigatória"); return; }
    setSaving(true);
    try {
      const submitData = { ...form, ativo: formAtivo };
      if (mode === "create") await create(submitData);
      else if (selected) await update(selected.id, submitData);
      setModalOpen(false);
    } catch (err: unknown) {
      console.error("[transportadoras] handleSubmit:", err);
    }
    setSaving(false);
  };

  const modalidadeLabel: Record<string, string> = { rodoviario: "Rodoviário", aereo: "Aéreo", maritimo: "Marítimo", ferroviario: "Ferroviário", multimodal: "Multimodal" };

  const hasChanges = useMemo(() => {
    if (mode === "create") return false;
    if (!selected) return false;
    const original: Record<string, string> = {
      nome_razao_social: selected.nome_razao_social || "",
      nome_fantasia: selected.nome_fantasia || "",
      cpf_cnpj: selected.cpf_cnpj || "",
      contato: selected.contato || "",
      telefone: selected.telefone || "",
      email: selected.email || "",
      logradouro: selected.logradouro || "",
      numero: selected.numero || "",
      complemento: selected.complemento || "",
      bairro: selected.bairro || "",
      cidade: selected.cidade || "",
      uf: selected.uf || "",
      cep: selected.cep || "",
      modalidade: selected.modalidade || "rodoviario",
      prazo_medio: selected.prazo_medio || "",
      observacoes: selected.observacoes || "",
    };
    return JSON.stringify(form) !== JSON.stringify(original) || formAtivo !== selected.ativo;
  }, [form, formAtivo, mode, selected]);

  const remessaStatusMap: Record<string, { label: string; classes: string }> = {
    pendente:    { label: "Pendente",    classes: "bg-warning/10 text-warning border-warning/20" },
    postado:     { label: "Postado",     classes: "bg-info/10 text-info border-info/20" },
    em_transito: { label: "Em Trânsito", classes: "bg-info/10 text-info border-info/20" },
    entregue:    { label: "Entregue",    classes: "bg-success/10 text-success border-success/20" },
    devolvido:   { label: "Devolvido",   classes: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const filteredData = useMemo(() => {
    return data.filter(t => {
      if (ativoFilters.length > 0) {
        const status = t.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(status)) return false;
      }
      if (modalidadeFilters.length > 0) {
        if (!modalidadeFilters.includes(t.modalidade || "")) return false;
      }
      return true;
    });
  }, [data, ativoFilters, modalidadeFilters]);

  const columns = [
    {
      key: "nome_razao_social",
      mobilePrimary: true, label: "Transportadora", sortable: true,
      render: (t: Transportadora) => (
        <div>
          <p className="font-medium leading-tight">{t.nome_razao_social}</p>
          {t.nome_fantasia && t.nome_fantasia !== t.nome_razao_social && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">{t.nome_fantasia}</p>
          )}
        </div>
      ),
    },
    {
      key: "cpf_cnpj", label: "CNPJ",
      render: (t: Transportadora) => <span className="font-mono text-xs">{t.cpf_cnpj || "—"}</span>,
    },
    {
      key: "contato_principal", label: "Contato",
      render: (t: Transportadora) => {
        if (!t.telefone && !t.email) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="text-xs space-y-0.5">
            {t.telefone && <p className="font-medium tabular-nums">{t.telefone}</p>}
            {t.email && <p className="text-muted-foreground truncate max-w-xs">{t.email}</p>}
          </div>
        );
      },
    },
    {
      key: "cidade",
      mobileCard: true, label: "Cidade / UF", sortable: true,
      render: (t: Transportadora) => t.cidade
        ? <span className="text-xs">{t.cidade}{t.uf ? `/${t.uf}` : ""}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "modalidade",
      mobileCard: true, label: "Modalidade",
      render: (t: Transportadora) => {
        const label = modalidadeLabel[t.modalidade] || t.modalidade;
        if (!label) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs font-medium">{label}</span>;
      },
    },
    {
      key: "prazo_medio", label: "Prazo Médio",
      render: (t: Transportadora) => t.prazo_medio
        ? <span className="font-mono text-xs font-medium">{t.prazo_medio}d</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: "ativo",
      mobileCard: true, label: "Status", render: (t: Transportadora) => <StatusBadge status={t.ativo ? "Ativo" : "Inativo"} /> },
  ];

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  const modalidadeOptions: MultiSelectOption[] = [
    { label: "Rodoviário", value: "rodoviario" },
    { label: "Aéreo", value: "aereo" },
    { label: "Marítimo", value: "maritimo" },
    { label: "Ferroviário", value: "ferroviario" },
    { label: "Multimodal", value: "multimodal" },
  ];

  const activeFilterChips = useMemo(() => {
    const chips: FilterChip[] = [];
    ativoFilters.forEach(f => chips.push({
      key: "ativo", label: "Status", value: [f],
      displayValue: f === "ativo" ? "Ativo" : "Inativo",
    }));
    modalidadeFilters.forEach(f => chips.push({
      key: "modalidade", label: "Modalidade", value: [f],
      displayValue: modalidadeLabel[f] || f,
    }));
    return chips;
  }, [ativoFilters, modalidadeFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "ativo") setAtivoFilters(prev => prev.filter(v => v !== value));
    if (key === "modalidade") setModalidadeFilters(prev => prev.filter(v => v !== value));
  };

  const summaryAtivos = useMemo(() => data.filter(t => t.ativo).length, [data]);

  return (
    <AppLayout>
      <ModulePage
        title="Transportadoras"
        subtitle="Central de consulta de transportadoras e logística"
        addLabel="Nova Transportadora"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total" value={String(data.length)} icon={Truck} />
            <StatCard title="Ativas" value={String(summaryAtivos)} icon={UserCheck} iconColor="text-success" />
            <StatCard title="Inativas" value={String(data.length - summaryAtivos)} icon={UserX} />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, CNPJ ou cidade..."
          activeFilters={activeFilterChips}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setAtivoFilters([]); setModalidadeFilters([]); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={ativoOptions}
            selected={ativoFilters}
            onChange={setAtivoFilters}
            placeholder="Status"
            className="w-[130px]"
          />
          <MultiSelect
            options={modalidadeOptions}
            selected={modalidadeFilters}
            onChange={setModalidadeFilters}
            placeholder="Modalidade"
            className="w-[150px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="transportadoras"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
          onDelete={(t) => { setSelected(t); setDeleteConfirmOpen(true); }}
        />
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Nova Transportadora" : "Editar Transportadora"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-0">

          {/* Context bar for edit mode */}
          {mode === "edit" && selected && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 mb-5 text-xs text-muted-foreground rounded-md border bg-muted/30">
              <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
              {selected.created_at && <span>Cadastro: {formatDate(selected.created_at)}</span>}
              {selected.updated_at && <span>Atualizado: {formatDate(selected.updated_at)}</span>}
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{modalidadeLabel[selected.modalidade] || "—"}</span>
              {selected.cidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.cidade}{selected.uf ? `/${selected.uf}` : ""}</span>}
            </div>
          )}

          <Tabs defaultValue="dados-gerais" className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="dados-gerais" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Dados Gerais</TabsTrigger>
              <TabsTrigger value="contatos" className="gap-1.5"><Phone className="h-3.5 w-3.5" />Contatos</TabsTrigger>
              <TabsTrigger value="operacional" className="gap-1.5"><Truck className="h-3.5 w-3.5" />Operacional</TabsTrigger>
              <TabsTrigger value="endereco" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />Endereço</TabsTrigger>
              <TabsTrigger value="observacoes" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Obs.</TabsTrigger>
            </TabsList>

            {/* ── TAB: DADOS GERAIS ─────────────────────────── */}
            <TabsContent value="dados-gerais" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="col-span-2 space-y-2">
              <Label>CNPJ</Label>
              <div className="flex gap-1">
                <MaskedInput mask="cnpj" value={form.cpf_cnpj} onChange={(v) => setForm({ ...form, cpf_cnpj: v })} />
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={cnpjLoading}
                  title="Buscar dados pelo CNPJ e preencher automaticamente"
                  onClick={async () => {
                    const result = await buscarCnpj(form.cpf_cnpj);
                    if (result) setForm(prev => ({
                      ...prev,
                      nome_razao_social: result.razao_social || prev.nome_razao_social,
                      nome_fantasia: result.nome_fantasia || prev.nome_fantasia,
                      email: result.email || prev.email,
                      telefone: result.telefone || prev.telefone,
                      cidade: result.municipio || prev.cidade,
                      uf: result.uf || prev.uf,
                    }));
                  }}>
                  {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-tight">Informe o CNPJ e clique em buscar para preencher automaticamente.</p>
            </div>
            <div className="col-span-2 md:col-span-4 space-y-2">
              <Label>Razão Social / Nome *</Label>
              <Input value={form.nome_razao_social} onChange={(e) => setForm({ ...form, nome_razao_social: e.target.value })} required placeholder="Razão social ou nome da transportadora" />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome comercial (se diferente da razão social)" />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3 h-9 px-3 rounded-md border bg-background">
                <Switch checked={formAtivo} onCheckedChange={setFormAtivo} />
                <span className="text-sm text-muted-foreground">{formAtivo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: CONTATOS ─────────────────────────────── */}
            <TabsContent value="contatos" className="space-y-4 mt-0">
          <div className="mb-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Referência de atendimento</p>
              <div className="space-y-2">
                <Label>Contato Principal</Label>
                <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Nome do responsável ou setor de atendimento" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Canais de comunicação</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <MaskedInput mask="telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@transportadora.com.br" />
                </div>
              </div>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: OPERACIONAL ──────────────────────────── */}
            <TabsContent value="operacional" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground mb-4">Define como a transportadora opera e o prazo médio de entrega. Esses dados são usados em pedidos, remessas e compras.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Modalidade Principal</Label>
              <Select value={form.modalidade} onValueChange={(v) => setForm({ ...form, modalidade: v })}>
                <SelectTrigger className="h-10 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rodoviario">Rodoviário</SelectItem>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                  <SelectItem value="ferroviario">Ferroviário</SelectItem>
                  <SelectItem value="multimodal">Multimodal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground leading-tight">Forma predominante de transporte utilizada pela transportadora.</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Prazo Médio de Entrega</Label>
              <div className="relative">
                <Input value={form.prazo_medio} onChange={(e) => setForm({ ...form, prazo_medio: e.target.value })} placeholder="Ex: 3-5" className="h-10 pr-24 font-mono" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">dias úteis</span>
              </div>
              <p className="text-xs text-muted-foreground leading-tight">Prazo médio informado pela transportadora. Usado como referência em remessas.</p>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: ENDEREÇO ─────────────────────────────── */}
            <TabsContent value="endereco" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground mb-4">Informe o CEP para preenchimento automático do logradouro, bairro, cidade e UF.</p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="col-span-2 space-y-2">
              <Label>CEP</Label>
              <div className="flex gap-1">
                <MaskedInput mask="cep" value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} />
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={cepLoading}
                  title="Buscar endereço pelo CEP"
                  onClick={async () => {
                    const result = await buscarCep(form.cep);
                    if (result) setForm(prev => ({
                      ...prev,
                      logradouro: result.logradouro || prev.logradouro,
                      bairro: result.bairro || prev.bairro,
                      cidade: result.localidade || prev.cidade,
                      uf: result.uf || prev.uf,
                    }));
                  }}>
                  {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Logradouro</Label>
              <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua, Avenida, etc." />
            </div>
            <div className="col-span-1 space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Sala, Bloco, etc." />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="col-span-1 space-y-2">
              <Label>UF</Label>
              <Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} className="uppercase" />
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: OBSERVAÇÕES ──────────────────────────── */}
            <TabsContent value="observacoes" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground mb-4">Notas internas, operacionais e de atendimento sobre a transportadora.</p>
          <div className="mb-6">
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Restrições de atendimento, particularidades operacionais, observações de logística..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Uso no Sistema — edit mode only */}
          {mode === "edit" && (
            <>
              <div className="flex items-center gap-2 pt-3 pb-2 border-t">
                <Users className="w-4 h-4 text-primary/70" />
                <h3 className="font-semibold text-sm">Uso no Sistema</h3>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">apenas leitura</span>
              </div>
              {loadingModalCtx ? (
                <div className="mb-6 h-[72px] rounded-lg bg-muted/30 animate-pulse" />
              ) : (
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Clientes Vinculados</p>
                      <p className="font-bold text-2xl text-foreground">{modalCliCount}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Remessas</p>
                      <p className="font-bold text-2xl text-foreground">{modalRemCount}</p>
                    </div>
                  </div>
                  {(modalCliCount > 0 || modalRemCount > 0) ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Esta transportadora está em uso ativo. Considere inativar em vez de excluir caso necessário.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      Nenhum vínculo ativo encontrado para esta transportadora.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
            </TabsContent>
          </Tabs>

          {/* Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-xs">
              {hasChanges && (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />Há alterações não salvas
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </form>
      </FormModal>

      <ViewDrawerV2
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.nome_razao_social || "Detalhes da Transportadora"}
        badge={selected ? <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} /> : undefined}
        actions={selected ? <>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
        </> : undefined}
        summary={selected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {selected.nome_fantasia && selected.nome_fantasia !== selected.nome_razao_social && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{selected.nome_fantasia}</span>
              )}
              {selected.cpf_cnpj && (
                <span className="font-mono">{selected.cpf_cnpj}</span>
              )}
              {selected.cidade && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.cidade}{selected.uf ? `/${selected.uf}` : ""}</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Modalidade</p>
                <p className="font-semibold text-sm text-foreground leading-tight">{modalidadeLabel[selected.modalidade] || "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prazo Médio</p>
                <p className="font-mono font-bold text-sm text-foreground leading-tight">{selected.prazo_medio || "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Clientes</p>
                <p className="font-mono font-bold text-sm text-foreground">{clientesVinculados.length}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Remessas</p>
                <p className="font-mono font-bold text-sm text-foreground">{remessasVinculadas.length}</p>
              </div>
            </div>
          </div>
        ) : undefined}
        tabs={[
          {
            value: "resumo",
            label: "Resumo",
            content: selected ? (
              <div className="space-y-4">
                <ViewSection title="Identificação">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ViewField label="Razão Social"><span className="font-medium">{selected.nome_razao_social}</span></ViewField>
                    <ViewField label="Nome Fantasia">{selected.nome_fantasia || "—"}</ViewField>
                    <ViewField label="CNPJ"><span className="font-mono">{selected.cpf_cnpj || "—"}</span></ViewField>
                    <ViewField label="Status"><StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} /></ViewField>
                  </div>
                </ViewSection>
                <ViewSection title="Contato">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ViewField label="Responsável">{selected.contato || "—"}</ViewField>
                    <ViewField label="Telefone">{selected.telefone || "—"}</ViewField>
                    <ViewField label="E-mail" className="col-span-2">{selected.email || "—"}</ViewField>
                  </div>
                </ViewSection>
                <ViewSection title="Localização">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ViewField label="Cidade/UF">{selected.cidade ? `${selected.cidade}${selected.uf ? `/${selected.uf}` : ""}` : "—"}</ViewField>
                  </div>
                </ViewSection>
                <ViewSection title="Operação">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ViewField label="Modalidade">{modalidadeLabel[selected.modalidade] || "—"}</ViewField>
                    <ViewField label="Prazo Médio"><span className="font-mono">{selected.prazo_medio || "—"}</span></ViewField>
                  </div>
                  {selected.observacoes && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                      <p className="text-sm text-muted-foreground">{selected.observacoes}</p>
                    </div>
                  )}
                </ViewSection>
              </div>
            ) : null,
          },
          {
            value: "clientes",
            label: `Clientes (${clientesVinculados.length})`,
            content: (
              <div className="space-y-2">
                {clientesVinculados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente vinculado</p>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {[...clientesVinculados]
                      .sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99))
                      .map((ct, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/30 border-b last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {ct.prioridade === 1 && (
                              <Star className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            <RelationalLink to="/clientes">{ct.clientes?.nome_razao_social || "—"}</RelationalLink>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{ct.clientes?.cpf_cnpj || ""}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0 ml-2">
                          {ct.modalidade && <p>{ct.modalidade}</p>}
                          {ct.prazo_medio && <p className="font-mono">{ct.prazo_medio}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "remessas",
            label: `Remessas (${remessasVinculadas.length})`,
            content: (
              <div className="space-y-3">
                {remessasVinculadas.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(() => {
                      const emTransito = remessasVinculadas.filter(r => r.status_transporte === "em_transito").length;
                      const entregues = remessasVinculadas.filter(r => r.status_transporte === "entregue").length;
                      const pendentes = remessasVinculadas.filter(r => r.status_transporte === "pendente" || r.status_transporte === "postado").length;
                      const devolvidas = remessasVinculadas.filter(r => r.status_transporte === "devolvido").length;
                      return (
                        <>
                          {emTransito > 0 && <Badge variant="outline" className="bg-info/10 text-info border-info/20 gap-1"><Truck className="h-3 w-3" />{emTransito} em trânsito</Badge>}
                          {pendentes > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1"><Package className="h-3 w-3" />{pendentes} pendente{pendentes > 1 ? "s" : ""}</Badge>}
                          {entregues > 0 && <Badge variant="outline" className="bg-success/10 text-success border-success/20">{entregues} entregue{entregues > 1 ? "s" : ""}</Badge>}
                          {devolvidas > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="h-3 w-3" />{devolvidas} devolvida{devolvidas > 1 ? "s" : ""}</Badge>}
                        </>
                      );
                    })()}
                  </div>
                )}
                {remessasVinculadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma remessa vinculada</p>
                ) : (
                  <div className="space-y-1 max-h-[380px] overflow-y-auto">
                    {remessasVinculadas.map((r, idx) => {
                      const statusInfo = remessaStatusMap[r.status_transporte] || { label: r.status_transporte, classes: "bg-muted text-muted-foreground border-muted" };
                      return (
                        <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/30 border-b last:border-b-0 gap-2">
                          <div className="min-w-0 flex-1">
                            <RelationalLink type="remessa" id={r.id}>
                              {r.codigo_rastreio ? <span className="font-mono text-xs">{r.codigo_rastreio}</span> : <span className="text-xs text-muted-foreground italic">sem rastreio</span>}
                            </RelationalLink>
                            {r.clientes?.nome_razao_social && (
                              <p className="text-xs text-muted-foreground truncate">{r.clientes.nome_razao_social}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.classes}`}>{statusInfo.label}</Badge>
                            {r.previsao_entrega && (
                              <p className="text-[10px] text-muted-foreground">{new Date(r.previsao_entrega).toLocaleDateString("pt-BR")}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "logistica",
            label: "Logística",
            content: selected ? (
              <div className="space-y-4">
                <ViewSection title="Perfil Operacional">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ViewField label="Modalidade">
                      <span className="font-semibold">{modalidadeLabel[selected.modalidade] || "—"}</span>
                    </ViewField>
                    <ViewField label="Prazo Médio">
                      {selected.prazo_medio
                        ? <span className="font-mono font-bold">{selected.prazo_medio}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </ViewField>
                  </div>
                </ViewSection>
                {remessasVinculadas.length > 0 && (() => {
                  const servicos = [...new Set(remessasVinculadas.map(r => r.servico).filter(Boolean))];
                  return servicos.length > 0 ? (
                    <ViewSection title="Serviços Utilizados">
                      <div className="flex flex-wrap gap-1.5">
                        {servicos.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </ViewSection>
                  ) : null;
                })()}
                <ViewSection title="Observações Logísticas">
                  {selected.observacoes
                    ? <p className="text-sm text-muted-foreground">{selected.observacoes}</p>
                    : <p className="text-sm text-muted-foreground italic">Nenhuma observação registrada.</p>}
                </ViewSection>
              </div>
            ) : null,
          },
        ]}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => { if (selected) { setDrawerOpen(false); remove(selected.id); } setDeleteConfirmOpen(false); }}
        title="Excluir transportadora"
        description={`Tem certeza que deseja excluir "${selected?.nome_razao_social || ""}"? Esta ação não pode ser desfeita.`}
      >
        {(clientesVinculados.length > 0 || remessasVinculadas.length > 0) && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Atenção: esta transportadora possui vínculos ativos
            </p>
            {clientesVinculados.length > 0 && (
              <p className="text-muted-foreground">{clientesVinculados.length} cliente{clientesVinculados.length > 1 ? "s" : ""} vinculado{clientesVinculados.length > 1 ? "s" : ""}</p>
            )}
            {remessasVinculadas.length > 0 && (
              <p className="text-muted-foreground">{remessasVinculadas.length} remessa{remessasVinculadas.length > 1 ? "s" : ""} relacionada{remessasVinculadas.length > 1 ? "s" : ""}</p>
            )}
            <p className="text-muted-foreground text-xs pt-1">Considere inativar a transportadora em vez de excluí-la.</p>
          </div>
        )}
      </ConfirmDialog>
    </AppLayout>
  );
}
