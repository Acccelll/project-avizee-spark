import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { StatCard } from "@/components/StatCard";
import { Package, UserCheck, UserX } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useDebounce } from "@/hooks/useDebounce";

interface GrupoProduto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

interface GrupoProdutoForm {
  nome: string;
  descricao: string;
  ativo: boolean;
}

const emptyForm: GrupoProdutoForm = { nome: "", descricao: "", ativo: true };

export default function GruposProduto() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const { data, loading, create, update, remove } = useSupabaseCrud<"grupos_produto">({
    table: "grupos_produto",
    ativoFilter: "todos",
    searchColumns: ["nome", "descricao"],
    searchTerm: debouncedSearch,
  });
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<GrupoProduto | null>(null);
  const [form, setForm] = useState<GrupoProdutoForm>(emptyForm);

  const openCreate = () => { setMode("create"); setSelected(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (item: GrupoProduto) => {
    setMode("edit");
    setSelected(item);
    setForm({ nome: item.nome, descricao: item.descricao || "", ativo: item.ativo });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const payload = { nome: form.nome.trim(), descricao: form.descricao.trim() || null, ativo: form.ativo };
    if (mode === "create") await create(payload);
    else if (selected) await update(selected.id, payload);
    setModalOpen(false);
  };

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = data as GrupoProduto[];
    return rows.filter((item) => {
      if (ativoFilters.length > 0) {
        const status = item.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(status)) return false;
      }
      if (!q) return true;
      return `${item.nome} ${item.descricao || ""}`.toLowerCase().includes(q);
    });
  }, [data, searchTerm, ativoFilters]);

  const activeFilters = useMemo<FilterChip[]>(() => {
    return ativoFilters.map((f) => ({ key: "ativo", label: "Status", value: f, displayValue: f === "ativo" ? "Ativo" : "Inativo" }));
  }, [ativoFilters]);

  const kpis = useMemo(() => {
    const all = data as GrupoProduto[];
    const ativos = all.filter((i) => i.ativo).length;
    return { total: all.length, ativos, inativos: all.length - ativos };
  }, [data]);

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  const columns = [
    { key: "nome", label: "Grupo", mobilePrimary: true },
    { key: "descricao", label: "Descrição", render: (item: GrupoProduto) => item.descricao || "—" },
    { key: "created_at", label: "Cadastro", render: (item: GrupoProduto) => formatDate(item.created_at) },
    { key: "ativo", label: "Status", render: (item: GrupoProduto) => <StatusBadge status={item.ativo ? "Ativo" : "Inativo"} /> },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Grupos de Produto"
        subtitle="Cadastre e mantenha os grupos utilizados em Produtos"
        icon={Package}
        primaryAction={{ label: "Novo Grupo", onClick: openCreate }}
        stats={<>
          <StatCard title="Total" value={kpis.total} icon={Package} />
          <StatCard title="Ativos" value={kpis.ativos} icon={UserCheck} />
          <StatCard title="Inativos" value={kpis.inativos} icon={UserX} />
        </>}
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome ou descrição"
          activeFilters={activeFilters}
          onRemoveFilter={(key, value) => key === "ativo" && setAtivoFilters((prev) => prev.filter((v) => v !== value))}
          onClearAll={() => setAtivoFilters([])}
        >
          <MultiSelect options={ativoOptions} selected={ativoFilters} onChange={setAtivoFilters} placeholder="Status" className="w-[180px]" />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="grupos_produto"
          onEdit={openEdit}
          onDelete={(item: GrupoProduto) => remove(item.id)}
        />
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Grupo de Produto" : "Editar Grupo de Produto"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="grupo-produto-ativo">Registro ativo</Label>
            <Switch
              id="grupo-produto-ativo"
              checked={form.ativo}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ativo: checked }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </FormModal>
    </AppLayout>
  );
}
