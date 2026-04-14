import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Loader2, Tag, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { logger } from '@/utils/logger';

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
  const { data, loading, create, update, remove, fetchData } = useSupabaseCrud<UnidadeMedida>({
    table: "unidades_medida",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<UnidadeFormData>(emptyForm);
  const [selected, setSelected] = useState<UnidadeMedida | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyForm });
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = (u: UnidadeMedida) => {
    setMode("edit");
    setSelected(u);
    setForm({
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
    setSaving(true);
    try {
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
      setModalOpen(false);
    } catch (err) {
      logger.error("[unidades-medida] erro ao salvar:", err);
    }
    setSaving(false);
  };

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.filter((u) => {
      if (ativoFilters.length > 0) {
        const val = u.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(val)) return false;
      }
      if (!q) return true;
      return [u.codigo, u.descricao, u.sigla].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, searchTerm, ativoFilters]);

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
      key: "ativo",
      mobileCard: true,
      label: "Status",
      render: (u: UnidadeMedida) => <StatusBadge status={u.ativo ? "Ativo" : "Inativo"} />,
    },
    {
      key: "updated_at",
      label: "Atualizado",
      render: (u: UnidadeMedida) => <span className="text-xs text-muted-foreground">{formatDate(u.updated_at)}</span>,
    },
  ];

  const kpis = useMemo(() => ({
    total: data.length,
    ativas: data.filter(u => u.ativo).length,
  }), [data]);

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  return (
    <AppLayout>
      <ModulePage
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
          onDelete={(u) => remove(u.id)}
          moduleKey="unidades-medida"
          emptyTitle="Nenhuma unidade de medida encontrada"
          emptyDescription="Cadastre as unidades utilizadas nos seus produtos."
        />
      </ModulePage>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "create" ? "Nova Unidade de Medida" : "Editar Unidade de Medida"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
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
                onChange={(e) => setForm({ ...form, sigla: e.target.value })}
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
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Unidade, Quilograma, Metro"
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes || ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre esta unidade..."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              id="ativo-switch"
            />
            <Label htmlFor="ativo-switch" className="cursor-pointer">
              {form.ativo ? "Ativo — disponível para seleção nos produtos" : "Inativo — não aparece nas seleções"}
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[100px]">
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : "Salvar"}
            </Button>
          </div>
        </form>
      </FormModal>
    </AppLayout>
  );
}
