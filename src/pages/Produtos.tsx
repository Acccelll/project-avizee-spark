import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModulePage } from "@/components/ModulePage";
import { SummaryCard } from "@/components/SummaryCard";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Package, FileText, TrendingUp, Archive, ShoppingCart, AlertCircle, CheckCircle2, AlignLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { FiscalAutocomplete } from "@/components/ui/FiscalAutocomplete";
import { cfopCodes, cstIcmsCodes } from "@/lib/fiscalData";
import { useNcmLookup } from '@/hooks/useNcmLookup';
import { Switch } from "@/components/ui/switch";

interface Produto {
  id: string;sku: string;codigo_interno: string;nome: string;descricao: string;
  grupo_id: string;unidade_medida: string;preco_custo: number;preco_venda: number;
  estoque_atual: number;estoque_minimo: number;ncm: string;cst: string;cfop_padrao: string;
  peso: number;eh_composto: boolean;ativo: boolean;created_at: string;
}

interface ComposicaoItem {
  id?: string;
  produto_filho_id: string;
  quantidade: number;
  ordem: number;
  nome?: string;
  sku?: string;
  preco_custo?: number;
}

interface FornecedorLink {
  id?: string;
  fornecedor_id: string;
  eh_principal: boolean;
  descricao_fornecedor: string;
  referencia_fornecedor: string;
  unidade_fornecedor: string;
  lead_time_dias: number;
  preco_compra: number;
}

type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado";

function getSituacaoEstoque(p: { estoque_atual?: number | null; estoque_minimo?: number | null }): SituacaoEstoque {
  const atual = Number(p.estoque_atual || 0);
  const minimo = Number(p.estoque_minimo || 0);
  if (atual <= 0) return "zerado";
  if (minimo > 0 && atual <= minimo) return "critico";
  if (minimo > 0 && atual <= minimo * 1.2) return "atencao";
  return "normal";
}

const situacaoEstoqueConfig: Record<SituacaoEstoque, { label: string; statusBadge: string; textClass: string }> = {
  normal:  { label: "Normal",           statusBadge: "confirmado",  textClass: "text-foreground"   },
  atencao: { label: "Em atenção",        statusBadge: "pendente",    textClass: "text-warning"      },
  critico: { label: "Abaixo do mínimo", statusBadge: "cancelado",   textClass: "text-destructive"  },
  zerado:  { label: "Sem estoque",      statusBadge: "cancelado",   textClass: "text-destructive"  },
};

const emptyProduto: Record<string, any> = {
  nome: "", sku: "", codigo_interno: "", descricao: "", unidade_medida: "UN",
  preco_custo: 0, preco_venda: 0, estoque_minimo: 0, ncm: "", cst: "", cfop_padrao: "", peso: 0, eh_composto: false,
  grupo_id: ""
};

const Produtos = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, loading, create, update, remove, duplicate } = useSupabaseCrud<Produto>({ table: "produtos" });
  const { pushView } = useRelationalNavigation();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyProduto);
  const [saving, setSaving] = useState(false);
  const [editComposicao, setEditComposicao] = useState<ComposicaoItem[]>([]);
  const [editFornecedores, setEditFornecedores] = useState<FornecedorLink[]>([]);
  const [fornecedoresList, setFornecedoresList] = useState<{id: string; nome_razao_social: string}[]>([]);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [margemLucro, setMargemLucro] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [estoqueFilters, setEstoqueFilters] = useState<string[]>([]);
  const [grupoFilters, setGrupoFilters] = useState<string[]>([]);
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<{id: string; nome: string}[]>([]);
  const { buscarNcm, loading: ncmLoading } = useNcmLookup();

  useEffect(() => {
    Promise.all([
      supabase.from("grupos_produto").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("fornecedores").select("id, nome_razao_social").eq("ativo", true).order("nome_razao_social"),
    ]).then(([{ data: g }, { data: f }]) => {
      if (g) setGrupos(g);
      if (f) setFornecedoresList(f);
    });
  }, []);

  useEffect(() => {
    const editId = (location.state as any)?.editId;
    if (!editId) return;
    navigate(location.pathname, { replace: true, state: {} });
    supabase.from("produtos").select("*").eq("id", editId).maybeSingle().then(({ data: p }) => {
      if (p) openEdit(p as Produto);
    });
  // openEdit is stable; navigate/pathname are stable refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const produtosDisponiveis = data;

  const custoComposto = editComposicao.reduce((s, c) => {
    const prod = data.find((p) => p.id === c.produto_filho_id);
    return s + c.quantidade * (prod?.preco_custo || 0);
  }, 0);

  const precoSugerido = custoComposto * (1 + margemLucro / 100);

  const custoParaCalculo = form.eh_composto ? custoComposto : (Number(form.preco_custo) || 0);
  const lucroBruto = (Number(form.preco_venda) || 0) - custoParaCalculo;
  const margemPercent = custoParaCalculo > 0 ? ((Number(form.preco_venda) || 0) / custoParaCalculo - 1) * 100 : 0;
  const fiscalCompleto = !!(form.ncm && form.cst && form.cfop_padrao);

  const openCreate = () => {
    setMode("create");setForm({ ...emptyProduto });
    setEditComposicao([]);setEditFornecedores([]);setEditingProduct(null);setMargemLucro(30);setModalOpen(true);
  };

  const openEdit = async (p: Produto) => {
    setMode("edit");
    setEditingProduct(p);
    setForm({
      id: p.id,
      nome: p.nome, sku: p.sku || "", codigo_interno: p.codigo_interno || "", descricao: p.descricao || "",
      unidade_medida: p.unidade_medida, preco_custo: p.preco_custo || 0, preco_venda: p.preco_venda,
      estoque_minimo: p.estoque_minimo || 0, ncm: (p.ncm || "").replace(/\D/g, ''), cst: p.cst || "", cfop_padrao: p.cfop_padrao || "",
      peso: p.peso || 0, eh_composto: p.eh_composto || false,
      grupo_id: p.grupo_id || ""
    });
    const [compRes, fornRes] = await Promise.all([
      p.eh_composto
        ? supabase.from("produto_composicoes").select("id, produto_filho_id, quantidade, ordem, produtos:produto_filho_id(nome, sku, preco_custo)").eq("produto_pai_id", p.id).order("ordem")
        : Promise.resolve({ data: [] }),
      supabase.from("produtos_fornecedores").select("*").eq("produto_id", p.id),
    ]);
    setEditComposicao(((compRes.data || []) as any[]).map((c: any) => ({
      id: c.id, produto_filho_id: c.produto_filho_id, quantidade: c.quantidade, ordem: c.ordem,
      nome: c.produtos?.nome, sku: c.produtos?.sku, preco_custo: c.produtos?.preco_custo
    })));
    setEditFornecedores(((fornRes.data || []) as any[]).map((f: any) => ({
      id: f.id, fornecedor_id: f.fornecedor_id, eh_principal: f.eh_principal || false,
      descricao_fornecedor: f.descricao_fornecedor || "", referencia_fornecedor: f.referencia_fornecedor || "",
      unidade_fornecedor: f.unidade_fornecedor || "", lead_time_dias: f.lead_time_dias || 0, preco_compra: f.preco_compra || 0,
    })));
    const custo = p.preco_custo || 0;
    setMargemLucro(custo > 0 ? Math.round((p.preco_venda / custo - 1) * 100) : 30);
    setModalOpen(true);
  };

  const openView = (p: Produto) => {
    pushView("produto", p.id);
  };

  const addComponent = () => {
    setEditComposicao([...editComposicao, { produto_filho_id: "", quantidade: 1, ordem: editComposicao.length + 1 }]);
  };
  const removeComponent = (idx: number) => setEditComposicao(editComposicao.filter((_, i) => i !== idx));
  const updateComponent = (idx: number, field: string, value: any) => {
    const updated = [...editComposicao];
    (updated[idx] as any)[field] = value;
    setEditComposicao(updated);
  };

  const addFornecedor = () => {
    setEditFornecedores([...editFornecedores, { fornecedor_id: "", eh_principal: editFornecedores.length === 0, descricao_fornecedor: "", referencia_fornecedor: "", unidade_fornecedor: "", lead_time_dias: 0, preco_compra: 0 }]);
  };
  const removeFornecedor = (idx: number) => setEditFornecedores(editFornecedores.filter((_, i) => i !== idx));
  const updateFornecedor = (idx: number, field: string, value: any) => {
    const updated = [...editFornecedores];
    (updated[idx] as any)[field] = value;
    setEditFornecedores(updated);
  };
  const setPrincipalFornecedor = (idx: number) => {
    setEditFornecedores(editFornecedores.map((f, i) => ({ ...f, eh_principal: i === idx })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.preco_venda) {toast.error("Nome e preço de venda são obrigatórios");return;}
    if (Number(form.preco_venda) < 0) {toast.error("Preço de venda não pode ser negativo");return;}
    if (!form.eh_composto && Number(form.preco_custo) < 0) {toast.error("Preço de custo não pode ser negativo");return;}
    if (Number(form.peso) < 0) {toast.error("Peso não pode ser negativo");return;}
    if (form.eh_composto && editComposicao.length === 0) {toast.error("Produto composto precisa de ao menos um componente");return;}
    if (form.eh_composto && editComposicao.some((c) => !c.produto_filho_id)) {toast.error("Selecione o produto para todos os componentes");return;}
    const fornDups = editFornecedores.map(f => f.fornecedor_id).filter(Boolean);
    if (editFornecedores.some(f => !f.fornecedor_id)) {toast.error("Selecione o fornecedor para todos os vínculos ou remova os vazios");return;}
    if (fornDups.length !== new Set(fornDups).size) {toast.error("Fornecedor duplicado: o mesmo fornecedor não pode ser vinculado duas vezes");return;}
    setSaving(true);
    try {
      const payload = { ...form, preco_custo: form.eh_composto ? custoComposto : form.preco_custo };
      let produtoId: string;
      if (mode === "create") {
        const result = await create(payload);
        produtoId = (result as any).id;
      } else if (form.id) {
        await update(form.id, payload);
        produtoId = form.id;
      } else {
        return;
      }
      if (form.eh_composto) {
        await supabase.from("produto_composicoes").delete().eq("produto_pai_id", produtoId);
        if (editComposicao.length > 0) {
          const rows = editComposicao.map((c, i) => ({ produto_pai_id: produtoId, produto_filho_id: c.produto_filho_id, quantidade: c.quantidade, ordem: i + 1 }));
          const { error } = await supabase.from("produto_composicoes").insert(rows);
          if (error) {console.error('[produtos] composição:', error);toast.error("Erro ao salvar composição. Tente novamente.");}
        }
      }
      await supabase.from("produtos_fornecedores").delete().eq("produto_id", produtoId);
      const validForn = editFornecedores.filter(f => f.fornecedor_id);
      if (validForn.length > 0) {
        const fRows = validForn.map(f => ({
          produto_id: produtoId, fornecedor_id: f.fornecedor_id, eh_principal: f.eh_principal,
          descricao_fornecedor: f.descricao_fornecedor || null, referencia_fornecedor: f.referencia_fornecedor || null,
          unidade_fornecedor: f.unidade_fornecedor || null, lead_time_dias: f.lead_time_dias || null,
          preco_compra: f.preco_compra || null,
        }));
        const { error } = await supabase.from("produtos_fornecedores").insert(fRows);
        if (error) {console.error('[produtos] fornecedores:', error);toast.error("Erro ao salvar fornecedores. Tente novamente.");}
      }
      setModalOpen(false);
    } catch (err) {
      console.error('[produtos] erro ao salvar:', err);
      toast.error("Erro ao salvar produto");
    }
    setSaving(false);
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((p) => {
      const isComposto = Boolean(p.eh_composto);
      const situacao = getSituacaoEstoque(p);

      if (ativoFilters.length > 0) {
        const val = p.ativo !== false ? "ativo" : "inativo";
        if (!ativoFilters.includes(val)) return false;
      }

      if (tipoFilters.length > 0) {
        const type = isComposto ? "composto" : "simples";
        if (!tipoFilters.includes(type)) return false;
      }

      if (estoqueFilters.length > 0) {
        if (!estoqueFilters.includes(situacao)) return false;
      }

      if (grupoFilters.length > 0 && !grupoFilters.includes(p.grupo_id || "sem_grupo")) {
        return false;
      }

      if (!query) return true;
      return [p.nome, p.sku, p.codigo_interno, p.descricao, p.ncm].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, ativoFilters, estoqueFilters, searchTerm, tipoFilters, grupoFilters]);

  const columns = [
    {
      key: "codigo_interno",
      label: "Código",
      sortable: true,
      render: (p: Produto) => (
        <span className="font-mono text-xs text-muted-foreground">
          {p.codigo_interno || p.sku || "—"}
        </span>
      ),
    },
    {
      key: "nome",
      mobilePrimary: true,
      label: "Produto",
      sortable: true,
      render: (p: Produto) => (
        <div>
          <span className="font-medium text-sm">{p.nome}</span>
          {p.sku && (
            <p className="text-[11px] text-muted-foreground font-mono leading-tight">{p.sku}</p>
          )}
        </div>
      ),
    },
    {
      key: "unidade_medida",
      label: "UN",
      render: (p: Produto) => (
        <span className="text-xs text-muted-foreground">{p.unidade_medida || "UN"}</span>
      ),
    },
    {
      key: "estoque_atual",
      mobileCard: true,
      label: "Estoque",
      sortable: true,
      render: (p: Produto) => {
        const situacao = getSituacaoEstoque(p);
        const cfg = situacaoEstoqueConfig[situacao];
        return (
          <div className="space-y-0.5">
            <span className={`font-mono text-sm font-semibold ${cfg.textClass}`}>
              {p.estoque_atual ?? 0}
              <span className="text-[11px] text-muted-foreground ml-1 font-normal">{p.unidade_medida}</span>
            </span>
            {Number(p.estoque_minimo) > 0 && (
              <p className="text-[10px] text-muted-foreground font-mono leading-none">
                mín: {p.estoque_minimo}
              </p>
            )}
            {situacao !== "normal" && (
              <StatusBadge
                status={cfg.statusBadge}
                label={cfg.label}
                className="text-[10px] px-1.5 h-4 mt-0.5"
              />
            )}
          </div>
        );
      },
    },
    {
      key: "preco_venda",
      mobileCard: true,
      label: "P. Venda",
      sortable: true,
      render: (p: Produto) => (
        <span className="font-semibold font-mono text-sm">{formatCurrency(p.preco_venda)}</span>
      ),
    },
    {
      key: "preco_custo",
      label: "P. Custo",
      sortable: true,
      render: (p: Produto) => (
        <span className="font-mono text-sm text-muted-foreground">{formatCurrency(p.preco_custo || 0)}</span>
      ),
    },
    {
      key: "margem",
      label: "Margem",
      render: (p: Produto) => {
        const custo = Number(p.preco_custo || 0);
        const venda = Number(p.preco_venda);
        const margem = custo > 0 ? (venda / custo - 1) * 100 : 0;
        return (
          <div className="flex flex-col">
            <span className={`font-mono text-xs ${margem > 0 ? "text-success" : margem < 0 ? "text-destructive" : ""}`}>
              {custo > 0 ? `${margem.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              +{formatCurrency(venda - custo)}
            </span>
          </div>
        );
      },
    },
    {
      key: "ativo",
      mobileCard: true,
      label: "Status",
      render: (p: Produto) => <StatusBadge status={p.ativo !== false ? "ativo" : "inativo"} />,
    },
    {
      key: "eh_composto",
      label: "Tipo",
      hidden: true,
      render: (p: Produto) => <StatusBadge status={p.eh_composto ? "composto" : "simples"} />,
    },
  ];

  const kpis = useMemo(() => {
    const ativos = data.filter(p => p.ativo !== false);
    const criticos = data.filter(p => {
      const s = getSituacaoEstoque(p);
      return s === "critico" || s === "zerado";
    });
    return { total: data.length, ativos: ativos.length, criticos: criticos.length };
  }, [data]);

  const prodActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];

    ativoFilters.forEach(f => {
      chips.push({
        key: "ativo",
        label: "Status",
        value: [f],
        displayValue: f === "ativo" ? "Ativo" : "Inativo",
      });
    });

    tipoFilters.forEach(f => {
      chips.push({
        key: "tipo",
        label: "Tipo",
        value: [f],
        displayValue: f === "simples" ? "Simples" : "Composto",
      });
    });

    estoqueFilters.forEach(f => {
      chips.push({
        key: "estoque",
        label: "Estoque",
        value: [f],
        displayValue: situacaoEstoqueConfig[f as SituacaoEstoque]?.label ?? f,
      });
    });

    grupoFilters.forEach(f => {
      const g = grupos.find(x => x.id === f);
      chips.push({
        key: "grupo",
        label: "Grupo",
        value: [f],
        displayValue: g?.nome || "Sem grupo",
      });
    });

    return chips;
  }, [ativoFilters, tipoFilters, estoqueFilters, grupoFilters, grupos]);

  const handleRemoveProdFilter = (key: string, value?: string) => {
    if (key === "ativo") setAtivoFilters(prev => prev.filter(v => v !== value));
    if (key === "tipo") setTipoFilters(prev => prev.filter(v => v !== value));
    if (key === "estoque") setEstoqueFilters(prev => prev.filter(v => v !== value));
    if (key === "grupo") setGrupoFilters(prev => prev.filter(v => v !== value));
  };

  const tipoOptions: MultiSelectOption[] = [
    { label: "Simples", value: "simples" },
    { label: "Composto", value: "composto" },
  ];

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativos", value: "ativo" },
    { label: "Inativos", value: "inativo" },
  ];

  const estoqueOptions: MultiSelectOption[] = [
    { label: "Sem estoque", value: "zerado" },
    { label: "Abaixo do mínimo", value: "critico" },
    { label: "Em atenção", value: "atencao" },
    { label: "Normal", value: "normal" },
  ];

  const grupoOptions: MultiSelectOption[] = [
    ...grupos.map(g => ({ label: g.nome, value: g.id })),
    { label: "Sem grupo", value: "sem_grupo" },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Produtos"
        subtitle="Consulta e gestão de produtos"
        addLabel="Novo Produto"
        onAdd={openCreate}
        summaryCards={
          <>
            <SummaryCard
              title="Total de Produtos"
              value={kpis.total}
              icon={Package}
              variant="info"
            />
            <SummaryCard
              title="Produtos Ativos"
              value={kpis.ativos}
              icon={CheckCircle2}
              variant="success"
            />
            <SummaryCard
              title="Abaixo do Mínimo"
              value={kpis.criticos}
              icon={AlertCircle}
              variant={kpis.criticos > 0 ? "danger" : "default"}
              onClick={kpis.criticos > 0 ? () => setEstoqueFilters(["critico", "zerado"]) : undefined}
              subtitle={kpis.criticos > 0 ? "Clique para filtrar" : undefined}
            />
          </>
        }
      >

        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, SKU ou código..."
          activeFilters={prodActiveFilters}
          onRemoveFilter={handleRemoveProdFilter}
          onClearAll={() => { setAtivoFilters([]); setTipoFilters([]); setEstoqueFilters([]); setGrupoFilters([]); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={ativoOptions}
            selected={ativoFilters}
            onChange={setAtivoFilters}
            placeholder="Status"
            className="w-[150px]"
          />
          <MultiSelect
            options={tipoOptions}
            selected={tipoFilters}
            onChange={setTipoFilters}
            placeholder="Tipo"
            className="w-[150px]"
          />
          <MultiSelect
            options={estoqueOptions}
            selected={estoqueFilters}
            onChange={setEstoqueFilters}
            placeholder="Estoque"
            className="w-[180px]"
          />
          <MultiSelect
            options={grupoOptions}
            selected={grupoFilters}
            onChange={setGrupoFilters}
            placeholder="Grupos"
            className="w-[200px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="produtos"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
          onDelete={(p) => remove(p.id)}
        />
      </ModulePage>

      {/* Form Modal */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Produto" : "Editar Produto"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-0">

          {/* Context banner — edit mode only */}
          {mode === "edit" && editingProduct && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg border mb-4 text-xs text-muted-foreground">
              <span className={`font-medium ${(editingProduct as any).ativo !== false ? "text-emerald-600" : "text-muted-foreground"}`}>
                {(editingProduct as any).ativo !== false ? "● Ativo" : "○ Inativo"}
              </span>
              {(editingProduct as any).updated_at && <>
                <span>·</span>
                <span>Última atualização: {formatDate((editingProduct as any).updated_at)}</span>
              </>}
              <span>·</span>
              <button type="button" className="text-primary underline hover:opacity-80" onClick={() => { setModalOpen(false); openView(editingProduct); }}>
                Ver resumo completo
              </button>
            </div>
          )}

          <Tabs defaultValue="dados-gerais" className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="dados-gerais" className="gap-1.5"><Package className="h-3.5 w-3.5" />Dados Gerais</TabsTrigger>
              <TabsTrigger value="estoque" className="gap-1.5"><Archive className="h-3.5 w-3.5" />Estoque</TabsTrigger>
              <TabsTrigger value="fiscal" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Fiscal</TabsTrigger>
              <TabsTrigger value="compras" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />Compras</TabsTrigger>
              <TabsTrigger value="observacoes" className="gap-1.5"><AlignLeft className="h-3.5 w-3.5" />Obs.</TabsTrigger>
            </TabsList>

            {/* ── TAB: DADOS GERAIS ─────────────────────────── */}
            <TabsContent value="dados-gerais" className="space-y-4 mt-0">
          {/* ── Identificação ──────────────────────────── */}
          <div className="space-y-3 pt-1">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4" /> Identificação
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Nome do produto" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">SKU <span className="text-muted-foreground font-normal text-xs">(referência externa)</span></Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="font-mono" placeholder="Ex: PROD-001" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">Código Interno <span className="text-muted-foreground font-normal text-xs">(uso sistêmico)</span></Label>
                <Input value={form.codigo_interno} onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })} className="font-mono" placeholder="Ex: CI-0042" />
              </div>
              <div className="space-y-2">
                <Label>Grupo de Produto</Label>
                <Select value={form.grupo_id || "nenhum"} onValueChange={(v) => setForm({ ...form, grupo_id: v === "nenhum" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN</SelectItem><SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="MT">MT</SelectItem><SelectItem value="CX">CX</SelectItem>
                    <SelectItem value="PC">PC</SelectItem><SelectItem value="LT">LT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Tipo toggle */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 border">
              <span className={`text-sm ${!form.eh_composto ? "font-semibold" : "text-muted-foreground"}`}>Simples</span>
              <Switch
                checked={form.eh_composto}
                onCheckedChange={(v) => { setForm({ ...form, eh_composto: v }); if (!v) setEditComposicao([]); }}
              />
              <span className={`text-sm ${form.eh_composto ? "font-semibold" : "text-muted-foreground"}`}>Composto</span>
              <span className="text-xs text-muted-foreground ml-1">
                {form.eh_composto
                  ? "Custo calculado automaticamente pela composição de componentes."
                  : "Produto com custo definido manualmente."}
              </span>
            </div>
          </div>

          {/* ── Comercial ──────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 border-t pt-3">
              <TrendingUp className="w-4 h-4" /> Comercial
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {!form.eh_composto ? (
                <div className="space-y-2">
                  <Label>Preço de Custo</Label>
                  <Input type="number" step="0.01" min="0" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Preço de Custo</Label>
                  <div className="h-9 flex items-center font-mono text-sm text-muted-foreground border rounded-md px-3 bg-muted/30">
                    {formatCurrency(custoComposto)} <span className="text-xs ml-1">(composição)</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Preço de Venda *</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: Number(e.target.value) })} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Lucro Bruto</Label>
                <div className={`h-9 flex items-center font-mono text-sm font-semibold border rounded-md px-3 ${lucroBruto >= 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-destructive bg-destructive/5"}`}>
                  {formatCurrency(lucroBruto)}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Margem</Label>
                <div className={`h-9 flex items-center font-mono text-sm font-semibold border rounded-md px-3 ${margemPercent >= 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-destructive bg-destructive/5"}`}>
                  {custoParaCalculo > 0 ? `${margemPercent.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: ESTOQUE ─────────────────────────────── */}
            <TabsContent value="estoque" className="space-y-4 mt-0">
          {/* ── Suprimentos e Logística ──────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Archive className="w-4 h-4" /> Suprimentos e Logística
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estoque Mínimo</Label>
                <Input type="number" min="0" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
                {Number(form.estoque_minimo) === 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Sem estoque mínimo definido — produto sem controle de reposição.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Peso Unitário (kg)</Label>
                <Input type="number" step="0.001" min="0" value={form.peso} onChange={(e) => setForm({ ...form, peso: Number(e.target.value) })} />
              </div>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: FISCAL ──────────────────────────────── */}
            <TabsContent value="fiscal" className="space-y-4 mt-0">
          {/* ── Dados Fiscais ──────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> Dados Fiscais
              {fiscalCompleto && (
                <span className="ml-1 text-xs text-emerald-600 font-normal flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Completo
                </span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CST</Label>
                <FiscalAutocomplete data={cstIcmsCodes} value={form.cst} onChange={(v) => setForm({ ...form, cst: v })} placeholder="Ex: 000" />
                <p className="text-xs text-muted-foreground">Código de Situação Tributária do ICMS.</p>
              </div>
              <div className="space-y-2">
                <Label>CFOP Padrão</Label>
                <FiscalAutocomplete data={cfopCodes} value={form.cfop_padrao} onChange={(v) => setForm({ ...form, cfop_padrao: v })} placeholder="Ex: 5102" />
                <p className="text-xs text-muted-foreground">Código Fiscal de Operações e Prestações.</p>
              </div>
              <div className="space-y-2">
                <Label>NCM</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.ncm || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setForm({ ...form, ncm: val });
                    }}
                    placeholder="Ex: 84713012"
                    className={`flex-1 font-mono ${form.ncm && (form.ncm.length < 4 || form.ncm.length > 8) ? "border-destructive" : ""}`}
                    maxLength={8}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    disabled={ncmLoading || (form.ncm || '').replace(/\D/g, '').length < 4}
                    onClick={async () => {
                      const result = await buscarNcm(form.ncm || '');
                      if (result) setForm({ ...form, ncm: result.codigo });
                    }}
                  >
                    {ncmLoading ? '...' : 'Verificar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">4–8 dígitos. Verifique na tabela TIPI da Receita Federal.</p>
              </div>
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: COMPRAS ─────────────────────────────── */}
            <TabsContent value="compras" className="space-y-4 mt-0">
          {/* ── Compras / Fornecedores ──────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Compras / Fornecedores
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={addFornecedor} className="gap-1">
                <Plus className="w-3 h-3" /> Fornecedor
              </Button>
            </div>
            {editFornecedores.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum fornecedor vinculado. Clique em "+ Fornecedor" para adicionar.</p>
            )}
            {editFornecedores.map((forn, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Fornecedor *</Label>
                    <Select value={forn.fornecedor_id} onValueChange={(v) => updateFornecedor(idx, "fornecedor_id", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {fornecedoresList.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Switch
                      checked={forn.eh_principal}
                      onCheckedChange={() => setPrincipalFornecedor(idx)}
                    />
                    <Label className="text-xs cursor-pointer whitespace-nowrap">Principal</Label>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeFornecedor(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cód. Fornecedor (De/Para)</Label>
                    <Input className="h-9 font-mono" value={forn.referencia_fornecedor} onChange={(e) => updateFornecedor(idx, "referencia_fornecedor", e.target.value)} placeholder="Ex: REF-ABC" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição no Fornecedor</Label>
                    <Input className="h-9" value={forn.descricao_fornecedor} onChange={(e) => updateFornecedor(idx, "descricao_fornecedor", e.target.value)} placeholder="Como o fornecedor denomina este item" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unidade Forn.</Label>
                    <Input className="h-9" value={forn.unidade_fornecedor} onChange={(e) => updateFornecedor(idx, "unidade_fornecedor", e.target.value)} placeholder="UN" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lead Time (dias)</Label>
                    <Input type="number" min="0" className="h-9" value={forn.lead_time_dias} onChange={(e) => updateFornecedor(idx, "lead_time_dias", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço de Compra</Label>
                    <Input type="number" step="0.01" min="0" className="h-9" value={forn.preco_compra} onChange={(e) => updateFornecedor(idx, "preco_compra", Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Composição ──────────────────────────── */}
          {form.eh_composto &&
          <div className="space-y-3">
            <div className="flex items-center justify-between border-t pt-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Composição
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={addComponent} className="gap-1"><Plus className="w-3 h-3" /> Componente</Button>
            </div>
            <p className="text-xs text-muted-foreground">O custo do produto composto é calculado automaticamente pela soma dos componentes abaixo.</p>
            {editComposicao.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum componente adicionado</p>}
            {editComposicao.map((comp, idx) => {
              const prod = data.find((p) => p.id === comp.produto_filho_id);
              return (
                <div key={idx} className="grid grid-cols-[1fr_100px_80px_40px] gap-2 items-end">
                  <div className="space-y-1"><Label className="text-xs">Produto</Label>
                    <Select value={comp.produto_filho_id} onValueChange={(v) => updateComponent(idx, "produto_filho_id", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{produtosDisponiveis.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku ? `[${p.sku}] ` : ""}{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Qtd</Label><Input type="number" min={0.01} step="0.01" value={comp.quantidade} onChange={(e) => updateComponent(idx, "quantidade", Number(e.target.value))} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Custo</Label><p className="h-9 flex items-center text-xs font-mono text-muted-foreground">{prod ? formatCurrency(comp.quantidade * (prod.preco_custo || 0)) : "—"}</p></div>
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeComponent(idx)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
            {editComposicao.length > 0 &&
            <div className="border-t pt-3 space-y-2 bg-muted/20 rounded-lg p-3">
              <div className="flex justify-between text-sm"><span className="font-medium">Custo Total Composto</span><span className="font-mono font-semibold text-primary">{formatCurrency(custoComposto)}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Margem (%)</Label><Input type="number" step="1" value={margemLucro} onChange={(e) => setMargemLucro(Number(e.target.value))} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Preço Sugerido</Label><div className="h-9 flex items-center"><span className="font-mono font-semibold text-sm">{formatCurrency(precoSugerido)}</span><Button type="button" size="sm" variant="link" className="ml-2 text-xs h-auto p-0" onClick={() => setForm({ ...form, preco_venda: Number(precoSugerido.toFixed(2)) })}>Usar</Button></div></div>
              </div>
            </div>
            }
          </div>
          }
            </TabsContent>

            {/* ── TAB: OBSERVAÇÕES ─────────────────────────── */}
            <TabsContent value="observacoes" className="space-y-4 mt-0">
          {/* ── Descrição / Observações ──────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlignLeft className="w-4 h-4" /> Descrição / Observações
            </h3>
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descrição detalhada, características ou observações internas do produto..."
              rows={3}
            />
          </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

    </AppLayout>);

};

export default Produtos;
