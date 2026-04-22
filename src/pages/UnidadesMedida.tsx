import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useEditDirtyForm } from "@/hooks/useEditDirtyForm";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Loader2, Tag, CheckCircle2, Package } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { useEditDeepLink } from "@/hooks/useEditDeepLink";

interface UnidadeMedida {
  id: string;
  codigo: string;
  descricao: string;
  sigla: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

type UnidadeFormData = Omit<UnidadeMedida, "id" | "created_at" | "updated_at">;

const emptyForm: UnidadeFormData = {
  codigo: "",
  descricao: "",
  sigla: "",
  ativo: true,
  observacoes: "",
};

export default function UnidadesMedida() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const { data, loading, create, update, remove, fetchData } = useSupabaseCrud<UnidadeMedida>({
    table: "unidades_medida",
    searchTerm: debouncedSearch,
    filterAtivo: false,
    searchColumns: ["codigo", "descricao"],
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const { form, updateForm, reset, isDirty, markPristine } = useEditDirtyForm<UnidadeFormData>(emptyForm);
  const [selected, setSelected] = useState<UnidadeMedida | null>(null);
  const { saving, submit } = useSubmitLock();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);

  // KPI: contagem de produtos por código de unidade (relacionamento atualmente por TEXTO).
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: produtos, error } = await supabase
        .from("produtos")
        .select("unidade_medida")
        .eq("ativo", true);
      if (cancelled || error || !produtos) return;
      const counts: Record<string, number> = {};
      for (const p of produtos) {
        const k = (p.unidade_medida || "").toString().trim().toUpperCase();
        if (!k) continue;
        counts[k] = (counts[k] || 0) + 1;
      }
      setUsageMap(counts);
    })();
    return () => { cancelled = true; };
  }, [data]);

  // Deep-link: abrir edição via ?editId=… (consistência com outras entidades de Cadastros).
  useEditDeepLink<UnidadeMedida>({
    table: "unidades_medida",
    onLoad: (u) => openEdit(u),
  });

  const closeModal = async () => {
    if (isDirty && !(await confirm())) return;
    setModalOpen(false);
  };

  const openCreate = () => {
    setMode("create");
    reset({ ...emptyForm });
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = (u: UnidadeMedida) => {
    setMode("edit");
    setSelected(u);
    reset({
      codigo: u.codigo,
      descricao: u.descricao,
      sigla: u.sigla || "",
      ativo: u.ativo,
      observacoes: u.observacoes || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim()) { toast.error("Código é obrigatório"); return; }
    if (!form.descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    await submit(async () => {
      const payload = {
        ...form,
        codigo: form.codigo.trim().toUpperCase(),
        sigla: form.sigla?.trim() || null,
        observacoes: form.observacoes?.trim() || null,
      };
      if (mode === "create") {
        await create(payload);
      } else if (selected) {
        await update(selected.id, payload);
      }
      markPristine();
      setModalOpen(false);
    });
  };

  const filteredData = useMemo(() => {
    return data.filter((u) => {
      if (ativoFilters.length > 0) {
        const val = u.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(val)) return false;
      }
      return true;
    });
  }, [data, ativoFilters]);

  const activeFilterChips = useMemo((): FilterChip[] => {
    return ativoFilters.map(f => ({
      key: "ativo",
      label: "Status",
      value: [f],
      displayValue: f === "ativo" ? "Ativo" : "Inativo",
    }));
  }, [ativoFilters]);

  const columns = [
    {
      key: "codigo",
      mobilePrimary: true,
      label: "Código",
      sortable: true,
      render: (u: UnidadeMedida) => (
        <span className="font-mono font-semibold text-sm">{u.codigo}</span>
      ),
    },
    {
      key: "descricao",
      label: "Descrição",
      sortable: true,
      render: (u: UnidadeMedida) => <span className="text-sm">{u.descricao}</span>,
    },
    {
      key: "sigla",
      label: "Sigla",
      render: (u: UnidadeMedida) => u.sigla
        ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{u.sigla}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "uso",
      label: "Em uso",
      render: (u: UnidadeMedida) => {
        const n = usageMap[u.codigo.toUpperCase()] || 0;
        return n > 0
          ? <span className="text-xs font-medium">{n} produto{n === 1 ? "" : "s"}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "ativo",
      mobileCard: true,
      label: "Status",
      render: (u: UnidadeMedida) => <StatusBadge status={u.ativo ? "ativo" : "inativo"} />,
    },
    {
      key: "updated_at",
      label: "Atualizado",
      render: (u: UnidadeMedida) => <span className="text-xs text-muted-foreground">{formatDate(u.updated_at)}</span>,
    },
  ];

  const kpis = useMemo(() => {
    const codigosEmUso = new Set(Object.keys(usageMap).filter(k => (usageMap[k] || 0) > 0));
    const emUso = data.filter(u => codigosEmUso.has(u.codigo.toUpperCase())).length;
    return {
      total: data.length,
      ativas: data.filter(u => u.ativo).length,
      emUso,
    };
  }, [data, usageMap]);

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  return (
    <><ModulePage
        title="Unidades de Medida"
        subtitle="Cadastro mestre de unidades utilizadas em produtos"
        addLabel="Nova Unidade"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard
              title="Total"
              value={String(kpis.total)}
              icon={Tag}
            />
            <StatCard
              title="Ativas"
              value={String(kpis.ativas)}
              icon={CheckCircle2}
            />
            <StatCard
              title="Em uso por produtos"
              value={String(kpis.emUso)}
              icon={Package}
            />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por código ou descrição..."
          activeFilters={activeFilterChips}
          onRemoveFilter={(key, value) => {
            if (key === "ativo") setAtivoFilters(prev => prev.filter(v => v !== value));
          }}
          onClearAll={() => setAtivoFilters([])}
          count={filteredData.length}
        >
          <MultiSelect
            options={ativoOptions}
            selected={ativoFilters}
            onChange={setAtivoFilters}
            placeholder="Status"
            className="w-[150px]"
          />
        </AdvancedFilterBar>

        <DataTable
          data={filteredData}
          columns={columns}
          loading={loading}
          
          onEdit={openEdit}
          onDelete={async (u) => {
            const n = usageMap[u.codigo.toUpperCase()] || 0;
            if (n > 0) {
              const ok = await confirm({
                title: "Inativar unidade em uso?",
                description: `Esta unidade está vinculada a ${n} produto${n === 1 ? "" : "s"}. Eles continuarão funcionando, mas a unidade não aparecerá em novas seleções.`,
                confirmLabel: "Inativar mesmo assim",
                confirmVariant: "destructive",
              });
              if (!ok) return;
            }
            await remove(u.id);
          }}
          deleteBehavior="soft"
          moduleKey="unidades-medida"
          emptyTitle="Nenhuma unidade de medida encontrada"
          emptyDescription="Cadastre as unidades utilizadas nos seus produtos."
        />
      </ModulePage>

      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={mode === "create" ? "Nova Unidade de Medida" : "Editar Unidade de Medida"}
        mode={mode}
        identifier={mode === "edit" && selected?.codigo ? selected.codigo : undefined}
        status={mode === "edit" && selected ? <StatusBadge status={selected.ativo ? "ativo" : "inativo"} /> : undefined}
        isDirty={isDirty}
        footer={
          <FormModalFooter
            saving={saving}
            isDirty={isDirty}
            onCancel={closeModal}
            submitAsForm
            formId="unidade-form"
            mode={mode}
          />
        }
      >
        <form id="unidade-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => updateForm({ codigo: e.target.value.toUpperCase() })}
                placeholder="Ex: UN, KG, MT"
                className="font-mono"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">Código único em maiúsculas. Usado no cadastro de produtos.</p>
            </div>
            <div className="space-y-2">
              <Label>Sigla</Label>
              <Input
                value={form.sigla || ""}
                onChange={(e) => updateForm({ sigla: e.target.value })}
                placeholder="Ex: un, kg, m"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">Sigla de exibição (opcional).</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição <span className="text-destructive">*</span></Label>
            <Input
              value={form.descricao}
              onChange={(e) => updateForm({ descricao: e.target.value })}
              placeholder="Ex: Unidade, Quilograma, Metro"
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes || ""}
              onChange={(e) => updateForm({ observacoes: e.target.value })}
              placeholder="Informações adicionais sobre esta unidade..."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => updateForm({ ativo: v })}
              id="ativo-switch"
            />
            <Label htmlFor="ativo-switch" className="cursor-pointer">
              {form.ativo ? "Ativo — disponível para seleção nos produtos" : "Inativo — não aparece nas seleções"}
            </Label>
          </div>
        </form>
      </FormModal>
      {confirmDialog}
    </>
  );
}
