import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { StatCard } from "@/components/StatCard";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import {
  Edit, Trash2, Plus, X, FileText, Banknote, CreditCard, QrCode, CheckSquare,
  Building2, Wallet, AlertTriangle, Users, TrendingUp, CalendarDays, StickyNote,
  Info, CheckCircle, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface FormaPagamento {
  id: string;
  descricao: string;
  prazo_dias: number;
  parcelas: number;
  intervalos_dias: number[];
  gera_financeiro: boolean;
  tipo: string;
  observacoes: string;
  ativo: boolean;
  created_at: string;
}

interface ClienteVinculado {
  id: string;
  nome_razao_social: string;
  prazo_preferencial: number | null;
}

interface UsoResumo {
  lancamentos: number;
  caixa: number;
}

const tipoLabel: Record<string, string> = {
  dinheiro: "Dinheiro", boleto: "Boleto", cartao: "Cartão",
  pix: "PIX", cheque: "Cheque", deposito: "Depósito",
};

const tipoIcon: Record<string, React.ElementType> = {
  dinheiro: Banknote, boleto: FileText, cartao: CreditCard,
  pix: QrCode, cheque: CheckSquare, deposito: Building2,
};

const emptyForm: Record<string, any> = {
  descricao: "", prazo_dias: 0, parcelas: 1, intervalos_dias: [], gera_financeiro: true, tipo: "boleto", observacoes: "", ativo: true,
};

export default function FormasPagamento() {
  const { data, loading, create, update, remove } = useSupabaseCrud<FormaPagamento>({ table: "formas_pagamento" as any });
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<FormaPagamento | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Advanced filters
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [geraFinanceiroFilters, setGeraFinanceiroFilters] = useState<string[]>([]);

  // Dynamic intervals
  const [newIntervalo, setNewIntervalo] = useState<number>(30);

  // Related data for drawer
  const [clientesVinculados, setClientesVinculados] = useState<ClienteVinculado[]>([]);
  const [usoResumo, setUsoResumo] = useState<UsoResumo>({ lancamentos: 0, caixa: 0 });
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Fetch related data whenever drawer opens with a selected item
  useEffect(() => {
    if (!selected || !drawerOpen || !supabase) {
      setClientesVinculados([]);
      setUsoResumo({ lancamentos: 0, caixa: 0 });
      return;
    }
    let cancelled = false;
    setLoadingRelated(true);
    (async () => {
      const [clientesRes, lancamentosRes, caixaRes] = await Promise.all([
        (supabase as any)
          .from("clientes")
          .select("id, nome_razao_social, prazo_preferencial")
          .eq("forma_pagamento_padrao", selected.descricao)
          .eq("ativo", true)
          .limit(50),
        (supabase as any)
          .from("financeiro_lancamentos")
          .select("id", { count: "exact", head: true })
          .eq("forma_pagamento", selected.tipo),
        (supabase as any)
          .from("caixa_movimentos")
          .select("id", { count: "exact", head: true })
          .eq("forma_pagamento", selected.tipo),
      ]);
      if (!cancelled) {
        setClientesVinculados(clientesRes.data || []);
        setUsoResumo({
          lancamentos: lancamentosRes.count ?? 0,
          caixa: caixaRes.count ?? 0,
        });
        setLoadingRelated(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.id, drawerOpen]);

  const openCreate = () => { setMode("create"); setForm({ ...emptyForm }); setSelected(null); setModalOpen(true); };
  const openEdit = (f: FormaPagamento) => {
    setMode("edit"); setSelected(f);
    const intervalos = Array.isArray(f.intervalos_dias) ? f.intervalos_dias : [];
    setForm({ descricao: f.descricao, prazo_dias: f.prazo_dias, parcelas: f.parcelas, intervalos_dias: intervalos, gera_financeiro: f.gera_financeiro, tipo: f.tipo, observacoes: f.observacoes || "", ativo: f.ativo });
    setModalOpen(true);
  };
  const openView = (f: FormaPagamento) => { setSelected(f); setDrawerOpen(true); };

  const addIntervalo = () => {
    const current = Array.isArray(form.intervalos_dias) ? form.intervalos_dias : [];
    const updated = [...current, newIntervalo].sort((a, b) => a - b);
    setForm({ ...form, intervalos_dias: updated, parcelas: updated.length });
    setNewIntervalo((updated[updated.length - 1] || 0) + 30);
  };

  const removeIntervalo = (idx: number) => {
    const updated = (form.intervalos_dias as number[]).filter((_: any, i: number) => i !== idx);
    setForm({ ...form, intervalos_dias: updated, parcelas: Math.max(1, updated.length) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao) { toast.error("Descrição é obrigatória"); return; }
    const payload = {
      ...form,
      intervalos_dias: form.intervalos_dias.length > 0 ? form.intervalos_dias : [],
      parcelas: form.intervalos_dias.length > 0 ? form.intervalos_dias.length : form.parcelas,
    };
    if (mode === "create") await create(payload as any);
    else if (selected) await update(selected.id, payload as any);
    setModalOpen(false);
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((f) => {
      if (ativoFilters.length > 0) {
        const val = f.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(val)) return false;
      }
      if (tipoFilters.length > 0) {
        if (!tipoFilters.includes(f.tipo)) return false;
      }
      if (geraFinanceiroFilters.length > 0) {
        const val = f.gera_financeiro ? "sim" : "nao";
        if (!geraFinanceiroFilters.includes(val)) return false;
      }
      if (!query) return true;
      return f.descricao.toLowerCase().includes(query);
    });
  }, [data, searchTerm, ativoFilters, tipoFilters, geraFinanceiroFilters]);

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    ativoFilters.forEach((v) =>
      chips.push({ key: "ativo", label: "Status", value: v, displayValue: v === "ativo" ? "Ativo" : "Inativo" })
    );
    tipoFilters.forEach((v) =>
      chips.push({ key: "tipo",
      mobileCard: true, label: "Tipo", value: v, displayValue: tipoLabel[v] || v })
    );
    geraFinanceiroFilters.forEach((v) =>
      chips.push({ key: "gera_financeiro", label: "Gera Financeiro", value: v, displayValue: v === "sim" ? "Sim" : "Não" })
    );
    return chips;
  }, [ativoFilters, tipoFilters, geraFinanceiroFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "ativo") setAtivoFilters((prev) => prev.filter((v) => v !== value));
    if (key === "tipo") setTipoFilters((prev) => prev.filter((v) => v !== value));
    if (key === "gera_financeiro") setGeraFinanceiroFilters((prev) => prev.filter((v) => v !== value));
  };

  const summaryAtivos = useMemo(() => data.filter((f) => f.ativo).length, [data]);
  const summaryGeraFin = useMemo(() => data.filter((f) => f.gera_financeiro).length, [data]);

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  const tipoOptions: MultiSelectOption[] = Object.entries(tipoLabel).map(([value, label]) => ({ value, label }));

  const geraFinanceiroOptions: MultiSelectOption[] = [
    { label: "Gera Financeiro", value: "sim" },
    { label: "Não Gera", value: "nao" },
  ];

  const columns = [
    {
      key: "descricao",
      mobilePrimary: true, label: "Forma de Pagamento", sortable: true,
      render: (f: FormaPagamento) => {
        const Icon = tipoIcon[f.tipo];
        return (
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
            <span className="font-medium leading-tight">{f.descricao}</span>
          </div>
        );
      },
    },
    {
      key: "tipo", label: "Tipo",
      render: (f: FormaPagamento) => (
        <span className="text-xs font-medium">{tipoLabel[f.tipo] || f.tipo}</span>
      ),
    },
    {
      key: "prazo",
      mobileCard: true, label: "Prazo / Parcelas", sortable: true,
      render: (f: FormaPagamento) => {
        const intervals = Array.isArray(f.intervalos_dias) && f.intervalos_dias.length > 0 ? f.intervalos_dias : null;
        if (intervals) {
          return (
            <div>
              <span className="font-mono text-xs font-medium">{intervals.join(" / ")} d</span>
              <span className="ml-1 text-xs text-muted-foreground">({intervals.length}x)</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs font-medium">
            {f.prazo_dias === 0 ? "À vista" : `${f.prazo_dias}d`}
          </span>
        );
      },
    },
    {
      key: "gera_financeiro", label: "Gera Financeiro",
      render: (f: FormaPagamento) => (
        <Badge
          variant="outline"
          className={f.gera_financeiro
            ? "bg-success/10 text-success border-success/30 text-xs gap-1"
            : "text-xs gap-1 text-muted-foreground"}
        >
          {f.gera_financeiro ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
          {f.gera_financeiro ? "Sim" : "Não"}
        </Badge>
      ),
    },
    { key: "ativo", label: "Status", render: (f: FormaPagamento) => <StatusBadge status={f.ativo ? "Ativo" : "Inativo"} /> },
    {
      key: "observacoes", label: "Observações", hidden: true,
      render: (f: FormaPagamento) => f.observacoes
        ? <span className="text-xs text-muted-foreground truncate max-w-xs block">{f.observacoes}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Formas de Pagamento"
        subtitle="Central de consulta e parametrização de condições de pagamento"
        addLabel="Nova Forma"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total" value={String(data.length)} icon={CreditCard} />
            <StatCard title="Ativas" value={String(summaryAtivos)} icon={CheckCircle} iconColor="text-success" />
            <StatCard title="Inativas" value={String(data.length - summaryAtivos)} icon={Ban} />
            <StatCard title="Geram Financeiro" value={String(summaryGeraFin)} icon={Wallet} iconColor="text-primary" />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por descrição..."
          activeFilters={activeFilterChips}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setAtivoFilters([]); setTipoFilters([]); setGeraFinanceiroFilters([]); }}
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
            options={tipoOptions}
            selected={tipoFilters}
            onChange={setTipoFilters}
            placeholder="Tipo"
            className="w-[130px]"
          />
          <MultiSelect
            options={geraFinanceiroOptions}
            selected={geraFinanceiroFilters}
            onChange={setGeraFinanceiroFilters}
            placeholder="Financeiro"
            className="w-[140px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="formas_pagamento"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
          onDelete={(f) => { setSelected(f); setDeleteConfirmOpen(true); }}
        />
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Nova Forma de Pagamento" : "Editar Forma de Pagamento"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── BLOCO 1: IDENTIFICAÇÃO DA REGRA ───────────────────────── */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <CreditCard className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Identificação da Regra</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-descricao">Descrição <span className="text-destructive" aria-hidden="true">*</span></Label>
                <Input
                  id="fp-descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Ex: 30/60/90 DDL"
                  className="text-base font-medium"
                />
                <p className="text-xs text-muted-foreground">Nome da forma de pagamento como aparecerá em clientes, orçamentos e pedidos.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="deposito">Depósito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mode === "edit" && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={form.ativo}
                        onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                      />
                      <span className="text-sm text-muted-foreground">{form.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── BLOCO 2: CONDIÇÃO DE PAGAMENTO ────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <CalendarDays className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Condição de Pagamento</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Prazo Padrão{" "}
                  <span className="text-xs font-normal text-muted-foreground">(dias)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={form.prazo_dias}
                    onChange={(e) => setForm({ ...form, prazo_dias: Number(e.target.value) })}
                    className="w-28"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.prazo_dias === 0
                    ? "Pagamento à vista (0 dias)."
                    : `Vencimento padrão: ${form.prazo_dias} dias após a emissão.`}
                  {" "}Aplicado como padrão em clientes, orçamentos e pedidos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Intervalos de Parcelas <span className="text-xs font-normal text-muted-foreground">(dias por parcela)</span></Label>
                <p className="text-xs text-muted-foreground">Defina os dias de vencimento de cada parcela a partir da data de emissão. Se preenchido, substitui o prazo padrão no cálculo das parcelas.</p>
                <div className="flex flex-wrap gap-2 min-h-[36px] rounded-md border bg-muted/20 px-2 py-1.5">
                  {(form.intervalos_dias as number[]).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic self-center">Nenhum intervalo adicionado — pagamento em parcela única.</span>
                  ) : (
                    (form.intervalos_dias as number[]).map((d: number, idx: number) => (
                      <Badge key={idx} variant="secondary" className="gap-1 text-sm font-mono">
                        {d}d
                        <button type="button" onClick={() => removeIntervalo(idx)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Input type="number" min={1} value={newIntervalo} onChange={(e) => setNewIntervalo(Number(e.target.value))} className="w-24 h-8 text-sm" placeholder="Dias" />
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addIntervalo}>
                    <Plus className="w-3 h-3" /> Adicionar parcela
                  </Button>
                </div>
                {(form.intervalos_dias as number[]).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{(form.intervalos_dias as number[]).length}</span> parcela(s):{" "}
                    {(form.intervalos_dias as number[]).join(" / ")} dias.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── BLOCO 3: COMPORTAMENTO FINANCEIRO ─────────────────────── */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <Wallet className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Comportamento Financeiro</h3>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium">Gera Financeiro</p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativado, registra lançamentos automáticos no financeiro ao utilizar esta forma em pedidos e orçamentos.
                  </p>
                </div>
                <Switch
                  checked={form.gera_financeiro}
                  onCheckedChange={(v) => setForm({ ...form, gera_financeiro: v })}
                />
              </div>
            </div>
          </div>

          {/* ── BLOCO 4: USO / CONTEXTO ───────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <Info className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Uso / Contexto</h3>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><span className="font-medium text-foreground">Clientes:</span> pode ser definida como forma de pagamento padrão no cadastro do cliente.</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><span className="font-medium text-foreground">Orçamentos e Pedidos:</span> aplicada automaticamente quando o cliente possui esta forma como padrão.</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><span className="font-medium text-foreground">Financeiro:</span> {form.gera_financeiro ? "gera lançamentos automáticos ao finalizar pedidos." : "não gera lançamentos automáticos — ative em Comportamento Financeiro se necessário."}</span>
              </div>
            </div>
          </div>

          {/* ── BLOCO 5: OBSERVAÇÕES ──────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <StickyNote className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Observações</h3>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Notas internas sobre o uso desta forma de pagamento. Instruções, restrições ou acordos comerciais específicos.</p>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Ex: Utilizada apenas para clientes com limite aprovado acima de R$ 5.000..."
                rows={3}
              />
            </div>
          </div>

          {/* ── RODAPÉ ────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{mode === "create" ? "Criar Forma de Pagamento" : "Salvar Alterações"}</Button>
          </div>
        </form>
      </FormModal>

      <ViewDrawerV2
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.descricao ?? "Detalhes da Forma de Pagamento"}
        badge={selected ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
            {selected.tipo && (
              <Badge variant="outline" className="text-xs gap-1 font-medium">
                {(() => { const Icon = tipoIcon[selected.tipo]; return Icon ? <Icon className="w-3 h-3" /> : null; })()}
                {tipoLabel[selected.tipo] || selected.tipo}
              </Badge>
            )}
          </div>
        ) : undefined}
        actions={selected ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
          </>
        ) : undefined}
        summary={selected ? (
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border bg-card px-3 py-2.5 text-center space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prazo</p>
              <p className="font-mono font-bold text-sm text-foreground">
                {selected.prazo_dias === 0 ? "À vista" : `${selected.prazo_dias}d`}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2.5 text-center space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Parcelas</p>
              <p className="font-mono font-bold text-sm text-foreground">
                {Array.isArray(selected.intervalos_dias) && selected.intervalos_dias.length > 0
                  ? selected.intervalos_dias.length
                  : selected.parcelas}x
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2.5 text-center space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Clientes</p>
              <p className="font-mono font-bold text-sm text-foreground">
                {loadingRelated ? "—" : clientesVinculados.length}
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2.5 text-center space-y-0.5 ${selected.gera_financeiro ? "bg-success/5 border-success/30" : "bg-card"}`}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fin.</p>
              <p className={`font-bold text-sm ${selected.gera_financeiro ? "text-success" : "text-muted-foreground"}`}>
                {selected.gera_financeiro ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        ) : undefined}
        tabs={selected ? [
          {
            value: "resumo",
            label: "Resumo",
            content: (
              <div className="space-y-4">
                <ViewSection title="Regra">
                  <div className="grid grid-cols-2 gap-4">
                    <ViewField label="Prazo padrão">
                      <span className="font-mono font-semibold">
                        {selected.prazo_dias === 0 ? "À vista" : `${selected.prazo_dias} dias`}
                      </span>
                    </ViewField>
                    <ViewField label="Parcelas">
                      <span className="font-mono font-semibold">
                        {Array.isArray(selected.intervalos_dias) && selected.intervalos_dias.length > 0
                          ? `${selected.intervalos_dias.length}x`
                          : `${selected.parcelas}x`}
                      </span>
                    </ViewField>
                  </div>
                  <ViewField label="Gera Financeiro">
                    <Badge
                      variant={selected.gera_financeiro ? "default" : "secondary"}
                      className={selected.gera_financeiro
                        ? "bg-success/10 text-success border border-success/30 gap-1"
                        : "gap-1"}
                    >
                      <Wallet className="w-3 h-3" />
                      {selected.gera_financeiro ? "Sim — gera lançamento financeiro" : "Não gera lançamento financeiro"}
                    </Badge>
                  </ViewField>
                  <ViewField label="Status"><StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} /></ViewField>
                </ViewSection>

                {Array.isArray(selected.intervalos_dias) && selected.intervalos_dias.length > 0 && (
                  <ViewSection title="Tabela de parcelas">
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Parcela</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Vencimento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.intervalos_dias.map((d: number, idx: number) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                              <td className="px-3 py-1.5 text-xs">{idx + 1}ª parcela</td>
                              <td className="px-3 py-1.5 text-xs font-mono text-right">{d} dias</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ViewSection>
                )}

                <ViewSection title="Contexto">
                  <ViewField label="Tipo de pagamento">
                    <div className="flex items-center gap-1.5">
                      {(() => { const Icon = tipoIcon[selected.tipo]; return Icon ? <Icon className="w-3.5 h-3.5 text-muted-foreground" /> : null; })()}
                      <span>{tipoLabel[selected.tipo] || selected.tipo}</span>
                    </div>
                  </ViewField>
                </ViewSection>
              </div>
            ),
          },
          {
            value: "clientes",
            label: `Clientes${clientesVinculados.length > 0 ? ` (${clientesVinculados.length})` : ""}`,
            content: (
              <div className="space-y-4">
                {loadingRelated ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
                ) : clientesVinculados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum cliente usa esta forma como padrão.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Prazo pref.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesVinculados.map((c, idx) => (
                          <tr key={c.id} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                            <td className="px-3 py-2 text-xs">
                              <RelationalLink type="cliente" id={c.id}>{c.nome_razao_social}</RelationalLink>
                            </td>
                            <td className="px-3 py-2 text-xs font-mono text-right text-muted-foreground">
                              {c.prazo_preferencial ? `${c.prazo_preferencial}d` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "uso",
            label: "Uso no sistema",
            content: (
              <div className="space-y-4">
                {loadingRelated ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-card p-4 space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-wider">Lançamentos</p>
                        </div>
                        <p className="font-mono font-bold text-xl text-foreground">{usoResumo.lancamentos}</p>
                        <p className="text-[11px] text-muted-foreground">registros no financeiro com tipo {tipoLabel[selected.tipo] || selected.tipo}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4 space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Wallet className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-wider">Caixa</p>
                        </div>
                        <p className="font-mono font-bold text-xl text-foreground">{usoResumo.caixa}</p>
                        <p className="text-[11px] text-muted-foreground">movimentações com tipo {tipoLabel[selected.tipo] || selected.tipo}</p>
                      </div>
                    </div>
                    {usoResumo.lancamentos === 0 && usoResumo.caixa === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Esta forma ainda não foi utilizada em lançamentos ou movimentações.
                      </p>
                    ) : (
                      <div className="rounded-lg border bg-muted/30 p-3 flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Esta forma de pagamento está sendo usada ativamente no sistema.
                          {usoResumo.lancamentos > 0 && ` Há ${usoResumo.lancamentos} lançamento(s) financeiro(s) vinculado(s).`}
                          {usoResumo.caixa > 0 && ` Há ${usoResumo.caixa} movimentação(ões) de caixa.`}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ),
          },
          ...(selected.observacoes ? [{
            value: "observacoes",
            label: "Observações",
            content: (
              <div className="space-y-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.observacoes}</p>
              </div>
            ),
          }] : []),
        ] : []}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => { if (selected) { setDrawerOpen(false); remove(selected.id); } setDeleteConfirmOpen(false); }}
        title="Excluir forma de pagamento"
        description={`Tem certeza que deseja excluir "${selected?.descricao || ""}"? Esta ação não pode ser desfeita.`}
      >
        {selected && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Prazo padrão: </span>
                <span className="font-semibold font-mono">
                  {selected.prazo_dias === 0 ? "À vista" : `${selected.prazo_dias} dias`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Gera financeiro: </span>
                <span className={`font-semibold ${selected.gera_financeiro ? "text-success" : ""}`}>
                  {selected.gera_financeiro ? "Sim" : "Não"}
                </span>
              </div>
            </div>
            {(clientesVinculados.length > 0 || usoResumo.lancamentos > 0 || usoResumo.caixa > 0) && (
              <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/5 p-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  {clientesVinculados.length > 0 && (
                    <p><span className="font-semibold">{clientesVinculados.length}</span> cliente(s) usa(m) esta forma como padrão.</p>
                  )}
                  {usoResumo.lancamentos > 0 && (
                    <p><span className="font-semibold">{usoResumo.lancamentos}</span> lançamento(s) financeiro(s) vinculado(s).</p>
                  )}
                  {usoResumo.caixa > 0 && (
                    <p><span className="font-semibold">{usoResumo.caixa}</span> movimentação(ões) de caixa vinculada(s).</p>
                  )}
                  <p className="text-muted-foreground mt-1">Considere <strong>inativar</strong> em vez de excluir para preservar o histórico.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </AppLayout>
  );
}
