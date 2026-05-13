import { useMemo, useState } from "react";
import { Receipt, CheckCircle, Briefcase, Percent, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { AdvancedFilterBar, type FilterChip } from "@/components/AdvancedFilterBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useEditDirtyForm } from "@/hooks/useEditDirtyForm";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useUrlListState } from "@/hooks/useUrlListState";
import { useEditDeepLink } from "@/hooks/useEditDeepLink";
import { useCan } from "@/hooks/useCan";
import type { Servico } from "@/services/servicos.service";

const TIPO_TRIBUTACAO_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Microempresa municipal" },
  { value: 2, label: "Estimativa" },
  { value: 3, label: "Sociedade de profissionais" },
  { value: 4, label: "Cooperativa" },
  { value: 5, label: "MEI – Simples Nacional" },
  { value: 6, label: "ME / EPP – Simples Nacional" },
];

const UNIDADE_OPTIONS = ["UN", "H", "M2", "M3", "KM", "MES", "DIA", "SV"];

interface ServicoForm {
  codigo: string;
  descricao: string;
  unidade: string;
  codigo_servico_lc116: string;
  codigo_tributacao_municipio: string;
  aliquota_iss_pct: string; // editado em %, salvo /100
  tipo_tributacao_iss: number;
  retencao_iss: boolean;
  ativo: boolean;
}

const emptyForm: ServicoForm = {
  codigo: "",
  descricao: "",
  unidade: "UN",
  codigo_servico_lc116: "",
  codigo_tributacao_municipio: "",
  aliquota_iss_pct: "",
  tipo_tributacao_iss: 1,
  retencao_iss: false,
  ativo: true,
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export default function Servicos() {
  const { data, loading, create, update, remove } = useSupabaseCrud<Servico>({
    table: "servicos",
    filterAtivo: false,
    orderBy: "descricao",
    ascending: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Servico | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { form, updateForm, reset, isDirty, markPristine } = useEditDirtyForm<ServicoForm>(emptyForm);
  const { saving, submit } = useSubmitLock();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { can } = useCan();
  const canExcluir = can("produtos:excluir");

  const { value: filterValue, set: setFilter, clear: clearFilters } = useUrlListState({
    schema: {
      q: { type: "string" },
      ativo: { type: "stringArray" },
      retencao: { type: "stringArray" },
    },
  });
  const searchTerm = filterValue.q;
  const ativoFilters = filterValue.ativo;
  const retencaoFilters = filterValue.retencao;

  useEditDeepLink<Servico>({
    table: "servicos",
    onLoad: (s) => openEdit(s),
  });

  const closeModal = async () => {
    if (isDirty && !(await confirm())) return;
    setModalOpen(false);
  };

  const openCreate = () => {
    setMode("create");
    setSelected(null);
    reset({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (s: Servico) => {
    setMode("edit");
    setSelected(s);
    reset({
      codigo: s.codigo ?? "",
      descricao: s.descricao,
      unidade: s.unidade ?? "UN",
      codigo_servico_lc116: s.codigo_servico_lc116 ?? "",
      codigo_tributacao_municipio: s.codigo_tributacao_municipio ?? "",
      aliquota_iss_pct: s.aliquota_iss != null ? String((s.aliquota_iss * 100).toFixed(2)) : "",
      tipo_tributacao_iss: (s.tipo_tributacao_iss as number) ?? 1,
      retencao_iss: !!s.retencao_iss,
      ativo: s.ativo ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || form.descricao.trim().length < 3) {
      toast.error("Descrição é obrigatória (mínimo 3 caracteres).");
      return;
    }
    const lc = form.codigo_servico_lc116.trim();
    if (lc && !/^\d{2}\.\d{2,3}$/.test(lc)) {
      toast.error("Código LC 116 deve estar no formato 00.00 ou 00.000");
      return;
    }
    const aliquotaNum = form.aliquota_iss_pct.trim() === ""
      ? null
      : Number(form.aliquota_iss_pct.replace(",", "."));
    if (aliquotaNum != null && (Number.isNaN(aliquotaNum) || aliquotaNum < 0 || aliquotaNum > 10)) {
      toast.error("Alíquota ISS deve estar entre 0 e 10%.");
      return;
    }
    await submit(async () => {
      const payload = {
        codigo: form.codigo.trim() || null,
        descricao: form.descricao.trim(),
        unidade: form.unidade || "UN",
        codigo_servico_lc116: lc || null,
        codigo_tributacao_municipio: form.codigo_tributacao_municipio.trim() || null,
        aliquota_iss: aliquotaNum != null ? Number((aliquotaNum / 100).toFixed(4)) : null,
        tipo_tributacao_iss: form.tipo_tributacao_iss,
        retencao_iss: form.retencao_iss,
        ativo: form.ativo,
      };
      if (mode === "create") await create(payload as Partial<Servico>);
      else if (selected) await update(selected.id, payload as Partial<Servico>);
      markPristine();
      setModalOpen(false);
    });
  };

  const filtered = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    return data.filter((s) => {
      if (ativoFilters.length > 0) {
        const v = s.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(v)) return false;
      }
      if (retencaoFilters.length > 0) {
        const v = s.retencao_iss ? "sim" : "nao";
        if (!retencaoFilters.includes(v)) return false;
      }
      if (!q) return true;
      return (
        s.descricao.toLowerCase().includes(q)
        || (s.codigo ?? "").toLowerCase().includes(q)
        || (s.codigo_servico_lc116 ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, searchTerm, ativoFilters, retencaoFilters]);

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    ativoFilters.forEach((v) =>
      chips.push({ key: "ativo", label: "Status", value: v, displayValue: v === "ativo" ? "Ativo" : "Inativo" }),
    );
    retencaoFilters.forEach((v) =>
      chips.push({ key: "retencao", label: "Retenção ISS", value: v, displayValue: v === "sim" ? "Com retenção" : "Sem retenção" }),
    );
    return chips;
  }, [ativoFilters, retencaoFilters]);

  const removeChip = (key: string, value?: string) => {
    if (key === "ativo") setFilter({ ativo: ativoFilters.filter((v) => v !== value) });
    if (key === "retencao") setFilter({ retencao: retencaoFilters.filter((v) => v !== value) });
  };

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];
  const retencaoOptions: MultiSelectOption[] = [
    { label: "Com retenção", value: "sim" },
    { label: "Sem retenção", value: "nao" },
  ];

  const totalAtivos = data.filter((s) => s.ativo).length;
  const comRetencao = data.filter((s) => s.retencao_iss).length;
  const aliquotaMedia = (() => {
    const arr = data.map((s) => s.aliquota_iss).filter((v): v is number => typeof v === "number");
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  })();

  const columns = [
    {
      key: "codigo", label: "Código", sortable: true,
      render: (s: Servico) => s.codigo
        ? <span className="font-mono text-xs">{s.codigo}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "descricao", mobilePrimary: true, label: "Descrição", sortable: true,
      render: (s: Servico) => <span className="font-medium">{s.descricao}</span>,
    },
    {
      key: "codigo_servico_lc116", label: "LC 116", mobileCard: true,
      render: (s: Servico) => s.codigo_servico_lc116
        ? <Badge variant="outline" className="font-mono text-xs">{s.codigo_servico_lc116}</Badge>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "aliquota_iss", label: "ISS", mobileCard: true,
      render: (s: Servico) => <span className="font-mono text-xs">{fmtPct(s.aliquota_iss)}</span>,
    },
    {
      key: "retencao_iss", label: "Retenção", mobileCard: true,
      render: (s: Servico) => s.retencao_iss
        ? <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-xs">Sim</Badge>
        : <Badge variant="outline" className="text-xs text-muted-foreground">Não</Badge>,
    },
    {
      key: "ativo", label: "Status",
      render: (s: Servico) => <StatusBadge status={s.ativo ? "ativo" : "inativo"} />,
    },
  ];

  return (
    <>
      <ModulePage
        title="Serviços"
        subtitle="Cadastro de serviços (LC 116/2003) usado em NFS-e e itens de serviço"
        addLabel="Novo serviço"
        onAdd={openCreate}
        summaryCards={
          <>
            <SummaryCard title="Total" value={String(data.length)} icon={Briefcase} />
            <SummaryCard title="Ativos" value={String(totalAtivos)} icon={CheckCircle} variant="success" />
            <SummaryCard title="Com retenção ISS" shortTitle="Retenção" value={String(comRetencao)} icon={ShieldAlert} variant="warning" />
            <SummaryCard title="Alíquota média" value={fmtPct(aliquotaMedia)} icon={Percent} variant="info" />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={(v) => setFilter({ q: v })}
          searchPlaceholder="Buscar por descrição, código ou LC 116..."
          activeFilters={activeChips}
          onRemoveFilter={removeChip}
          onClearAll={() => clearFilters(["ativo", "retencao"])}
          count={filtered.length}
        >
          <MultiSelect
            options={ativoOptions}
            selected={ativoFilters}
            onChange={(v) => setFilter({ ativo: v })}
            placeholder="Status"
            className="w-[130px]"
          />
          <MultiSelect
            options={retencaoOptions}
            selected={retencaoFilters}
            onChange={(v) => setFilter({ retencao: v })}
            placeholder="Retenção"
            className="w-[150px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          moduleKey="servicos"
          showColumnToggle
          onEdit={openEdit}
          onDelete={canExcluir ? (s) => { setSelected(s); setDeleteOpen(true); } : undefined}
          deleteBehavior="soft"
          mobileStatusKey="ativo"
        />
      </ModulePage>

      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={mode === "create" ? "Novo Serviço" : "Editar Serviço"}
        size="lg"
        mode={mode}
        identifier={mode === "edit" && form.codigo ? form.codigo : undefined}
        isDirty={isDirty}
        footer={
          <FormModalFooter
            saving={saving}
            isDirty={isDirty}
            onCancel={closeModal}
            submitAsForm
            formId="servico-form"
            mode={mode}
            primaryLabel={mode === "create" ? "Criar Serviço" : "Salvar Alterações"}
          />
        }
      >
        <form id="servico-form" onSubmit={handleSubmit} className="space-y-6">

          {/* Identificação */}
          <section>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <Receipt className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Identificação</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sv-codigo">Código interno</Label>
                <Input
                  id="sv-codigo"
                  value={form.codigo}
                  onChange={(e) => updateForm({ codigo: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sv-desc">Descrição do serviço <span className="text-destructive">*</span></Label>
                <Input
                  id="sv-desc"
                  value={form.descricao}
                  onChange={(e) => updateForm({ descricao: e.target.value })}
                  required
                  placeholder="Ex: Consultoria em TI"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => updateForm({ unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADE_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Classificação fiscal */}
          <section>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <Briefcase className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Classificação fiscal</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sv-lc116">Código LC 116/2003</Label>
                <Input
                  id="sv-lc116"
                  value={form.codigo_servico_lc116}
                  onChange={(e) => updateForm({ codigo_servico_lc116: e.target.value })}
                  placeholder="ex: 01.01"
                />
                <p className="text-xs text-muted-foreground">
                  Consulte a lista de serviços tributáveis da Lei Complementar 116/2003.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sv-codmun">Código tributação município</Label>
                <Input
                  id="sv-codmun"
                  value={form.codigo_tributacao_municipio}
                  onChange={(e) => updateForm({ codigo_tributacao_municipio: e.target.value })}
                  placeholder="conforme prefeitura"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Tipo de tributação ISS</Label>
                <Select
                  value={String(form.tipo_tributacao_iss)}
                  onValueChange={(v) => updateForm({ tipo_tributacao_iss: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_TRIBUTACAO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ISS */}
          <section>
            <div className="flex items-center gap-2 pb-2 border-b mb-4">
              <Percent className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">ISS</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sv-aliq">Alíquota ISS (%)</Label>
                <Input
                  id="sv-aliq"
                  type="number"
                  min={0}
                  max={10}
                  step={0.01}
                  value={form.aliquota_iss_pct}
                  onChange={(e) => updateForm({ aliquota_iss_pct: e.target.value })}
                  placeholder="ex: 5.00"
                />
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">ISS retido na fonte pelo tomador</p>
                  <p className="text-xs text-muted-foreground">Quando ativo, o tomador desconta o ISS no pagamento.</p>
                </div>
                <Switch
                  checked={form.retencao_iss}
                  onCheckedChange={(v) => updateForm({ retencao_iss: v })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/20 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Serviço ativo</p>
                  <p className="text-xs text-muted-foreground">Inativos não aparecem em buscas de NFS-e.</p>
                </div>
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => updateForm({ ativo: v })}
                />
              </div>
            </div>
          </section>

        </form>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { if (selected) remove(selected.id); setDeleteOpen(false); }}
        title="Excluir serviço"
        description={`Tem certeza que deseja excluir "${selected?.descricao || ""}"?`}
      >
        <p className="text-xs text-muted-foreground">
          Considere <strong>inativar</strong> em vez de excluir para preservar histórico em notas existentes.
        </p>
      </ConfirmDialog>
      {confirmDialog}
    </>
  );
}