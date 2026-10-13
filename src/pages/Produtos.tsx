import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useUrlListState } from "@/hooks/useUrlListState";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { QueryErrorFallback } from "@/components/ui/QueryErrorFallback";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { ModulePage } from "@/components/ModulePage";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useServerSort } from "@/hooks/useServerSort";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { listGruposAtivos } from "@/services/produtos.service";
import { Package, AlertCircle, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCan } from "@/hooks/useCan";
import { ProdutoFormModal } from "@/pages/produtos/ProdutoFormModal";
import { MobileQuickAddFAB } from "@/components/MobileQuickAddFAB";
import { QuickAddProductModal } from "@/components/QuickAddProductModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileCardActionButton } from "@/components/ui/MobileCardActions";

type TipoItem = "produto" | "insumo" | "servico";

interface Produto {
  id: string; sku: string; codigo_interno: string; nome: string; descricao: string;
  grupo_id: string; unidade_medida: string; preco_custo: number; preco_venda: number;
  estoque_atual: number; estoque_minimo: number; ncm: string; cst: string; cfop_padrao: string;
  peso: number; eh_composto: boolean; ativo: boolean; created_at: string; updated_at?: string;
  tipo_item: TipoItem; variacoes?: string[] | null;
}

type ProdutoTableRow = Produto & { display_codigo: string; display_sku_secundario: string | null };

type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado" | "sem_minimo";

function getSituacaoEstoque(p: { estoque_atual?: number | null; estoque_minimo?: number | null }): SituacaoEstoque {
  const atual = Number(p.estoque_atual || 0);
  const minimo = Number(p.estoque_minimo || 0);
  // Zero físico é um fato; mínimo não configurado não significa "não controla".
  if (atual <= 0) return "zerado";
  if (minimo <= 0) return "sem_minimo";
  if (atual <= minimo) return "critico";
  if (atual <= minimo * 1.2) return "atencao";
  return "normal";
}

const situacaoEstoqueConfig: Record<SituacaoEstoque, { label: string; statusBadge: string; textClass: string }> = {
  normal:       { label: "Normal",           statusBadge: "confirmado", textClass: "text-foreground"      },
  atencao:      { label: "Em atenção",       statusBadge: "pendente",   textClass: "text-warning"         },
  critico:      { label: "Abaixo do mínimo", statusBadge: "pendente",   textClass: "text-warning"         },
  zerado:       { label: "Sem estoque",      statusBadge: "cancelado",  textClass: "text-destructive"     },
  sem_minimo:  { label: "Mínimo não definido",     statusBadge: "rascunho",   textClass: "text-muted-foreground" },
};

function compactProductCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function normalizeProductCode(value: string | null | undefined): string {
  const compact = compactProductCode(value);
  if (!compact) return "";
  const normalized = /[A-Z]/i.test(compact)
    ? compact.replace(/^0+(?=[A-Z0-9]*[A-Z])/i, "")
    : compact;
  return normalized || compact;
}
function getProdutoDisplayCodigo(produto: Pick<Produto, "codigo_interno" | "sku">): string {
  return normalizeProductCode(produto.codigo_interno) || normalizeProductCode(produto.sku) || "—";
}
function getProdutoDisplaySkuSecundario(produto: Pick<Produto, "codigo_interno" | "sku">): string | null {
  const sku = String(produto.sku ?? "").trim();
  if (!sku) return null;
  const skuNormalizado = normalizeProductCode(sku);
  const codigoPrincipal = normalizeProductCode(getProdutoDisplayCodigo(produto));
  return skuNormalizado && skuNormalizado !== codigoPrincipal ? sku : null;
}

const Produtos = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { value: filterValue, set: setFilter, clear: clearFilters } = useUrlListState({
    schema: {
      q: { type: "string" },
      tipo: { type: "stringArray" },
      tipoItem: { type: "stringArray" },
      estoque: { type: "stringArray" },
      grupo: { type: "stringArray" },
      ativo: { type: "stringArray" },
      cadastro: { type: "stringArray" },
    },
  });
  const searchTerm = filterValue.q;
  const setSearchTerm = (v: string) => setFilter({ q: v });
  const tipoFilters = filterValue.tipo;
  const setTipoFilters = (v: string[]) => setFilter({ tipo: v });
  const tipoItemFilters = filterValue.tipoItem;
  const setTipoItemFilters = (v: string[]) => setFilter({ tipoItem: v });
  const estoqueFilters = filterValue.estoque;
  const setEstoqueFilters = (v: string[]) => setFilter({ estoque: v });
  const grupoFilters = filterValue.grupo;
  const setGrupoFilters = (v: string[]) => setFilter({ grupo: v });
  const ativoFilters = filterValue.ativo;
  const setAtivoFilters = (v: string[]) => setFilter({ ativo: v });
  const cadastroFilters = filterValue.cadastro;
  const setCadastroFilters = (v: string[]) => setFilter({ cadastro: v });
  const debouncedSearch = useDebounce(searchTerm, 350);
  const { can } = useCan();
  const canExcluir = can("produtos:excluir");

  const serverFilters = useMemo(() => {
    const out: Array<{ column: string; value: string | string[] | boolean; operator?: "eq" | "in" }> = [];
    if (ativoFilters.length === 1) out.push({ column: "ativo", value: ativoFilters[0] === "ativo" });
    if (tipoItemFilters.length === 1) out.push({ column: "tipo_item", value: tipoItemFilters[0] });
    else if (tipoItemFilters.length > 1) out.push({ column: "tipo_item", value: tipoItemFilters, operator: "in" });
    if (tipoFilters.length === 1) out.push({ column: "eh_composto", value: tipoFilters[0] === "composto" });
    const realGroupIds = grupoFilters.filter((g) => g !== "sem_grupo");
    if (grupoFilters.length > 0 && realGroupIds.length === grupoFilters.length) {
      if (realGroupIds.length === 1) out.push({ column: "grupo_id", value: realGroupIds[0] });
      else out.push({ column: "grupo_id", value: realGroupIds, operator: "in" });
    }
    return out;
  }, [ativoFilters, tipoItemFilters, tipoFilters, grupoFilters]);

  const hasSemGrupoFilter = grupoFilters.includes("sem_grupo");
  const hasEstoqueFilter = estoqueFilters.length > 0;
  const needsCompleteResult = hasEstoqueFilter || hasSemGrupoFilter;
  const [filteredPage, setFilteredPage] = useState(0);

  const sort = useServerSort("sku", "asc");
  useEffect(() => { setFilteredPage(0); }, [debouncedSearch, tipoFilters.join(","), tipoItemFilters.join(","), estoqueFilters.join(","), grupoFilters.join(","), ativoFilters.join(","), cadastroFilters.join(","), sort.sortKey, sort.sortDir]);
  const {
    data,
    loading,
    isError,
    error: queryError,
    remove,
    fetchData,
    page,
    setPage,
    totalCount,
    hasMore,
    truncated,
  } = useSupabaseCrud<Produto>({
    table: "produtos",
    showToasts: false, // Mensagens específicas para inativação, não "registro removido".
    searchTerm: debouncedSearch,
    filterAtivo: false,
    filter: serverFilters,
    orFilters: cadastroFilters.includes("sem_preco")
      ? ["preco_venda.is.null,preco_venda.lte.0"] : undefined,
    searchColumns: ["nome", "sku", "codigo_interno", "ncm", "variacoes_text"],
    pageSize: 50,
    paginationMode: needsCompleteResult ? "all" : "paged",
    orderBy: sort.orderBy,
    ascending: sort.ascending,
  });
  // Uma edição/inativação pode retirar o último item da página atual.
  // Volta para a última página válida sem limpar os filtros do usuário.
  useEffect(() => {
    if (needsCompleteResult || loading || isError || page === 0 || data.length > 0) return;
    const ultimaPagina = totalCount != null
      ? Math.max(0, Math.ceil(totalCount / 50) - 1)
      : Math.max(0, page - 1);
    if (ultimaPagina < page) setPage(ultimaPagina);
  }, [needsCompleteResult, loading, isError, page, data.length, totalCount, setPage]);

  // Indicadores de pendência são contagens globais do cadastro ativo,
  // independentemente da página e dos filtros da listagem.
  const { data: qualidade } = useQuery({
    queryKey: ["produtos", "pendencias-cadastro"],
    queryFn: async () => {
      const [minimo, preco] = await Promise.all([
        supabase.from("produtos").select("id", { count: "exact", head: true })
          .eq("ativo", true).or("estoque_minimo.is.null,estoque_minimo.lte.0"),
        supabase.from("produtos").select("id", { count: "exact", head: true })
          .eq("ativo", true).or("preco_venda.is.null,preco_venda.lte.0"),
      ]);
      if (minimo.error || preco.error) throw minimo.error ?? preco.error;
      return { semMinimo: minimo.count ?? 0, semPreco: preco.count ?? 0 };
    },
    staleTime: 60_000,
  });
  const { pushView } = useRelationalNavigation();

  const { data: grupoLookup } = useQuery({
    queryKey: ["produtos", "lookup", "grupos-ativos"],
    queryFn: listGruposAtivos,
    staleTime: 5 * 60 * 1000,
  });
  const grupos = grupoLookup ?? [];

  // Modal de formulário (canônico — alinhado com Clientes/Fornecedores).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formProdutoId, setFormProdutoId] = useState<string | undefined>(undefined);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const openCreate = () => { setFormMode("create"); setFormProdutoId(undefined); setFormOpen(true); };
  const openEdit = (p: Produto) => { setFormMode("edit"); setFormProdutoId(p.id); setFormOpen(true); };
  const openView = (p: Produto) => pushView("produto", p.id);
  const closeForm = () => setFormOpen(false);
  const handleSaved = () => { void fetchData(); };
  const handleInativar = async (produto: Produto) => {
    try {
      await remove(produto.id);
      toast.success("Produto inativado. O cadastro permanece disponível no filtro de inativos.");
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível inativar o produto.";
      toast.error(message);
    }
  };

  // Suporte ao deep-link legado (?editId=, ?new=1) e às rotas redirecionadas
  // /produtos/novo e /produtos/:id/editar (agora abrem modal).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = (location.state as { editId?: string } | null)?.editId || params.get("editId");
    if (editId) {
      setFormMode("edit");
      setFormProdutoId(editId);
      setFormOpen(true);
      // Limpa o query param para não reabrir após fechar.
      params.delete("editId");
      navigate({ pathname: "/produtos", search: params.toString() }, { replace: true });
      return;
    }
    if (params.get("new") === "1") {
      setFormMode("create");
      setFormProdutoId(undefined);
      setFormOpen(true);
      params.delete("new");
      navigate({ pathname: "/produtos", search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot
  }, [location.search, location.state]);

  // Quando o filtro depende de uma regra composta (estoque ou sem grupo),
  // consulte todas as páginas antes de filtrar. Nunca filtre somente os 50
  // itens visíveis, pois isso quebra contagem e navegação.
  const filteredAll = useMemo(() => data
    .filter((p) => {
      if (hasEstoqueFilter && !estoqueFilters.includes(getSituacaoEstoque(p)) &&
          !(estoqueFilters.includes("sem_minimo") && Number(p.estoque_minimo || 0) <= 0)) return false;
      if (hasSemGrupoFilter && !grupoFilters.includes(p.grupo_id || "sem_grupo")) return false;
      return true;
    })
    // Nenhum cadastro é ocultado por deduplicação visual: cada linha tem ID próprio.
    .map<ProdutoTableRow>((produto) => ({
      ...produto,
      display_codigo: getProdutoDisplayCodigo(produto),
      display_sku_secundario: getProdutoDisplaySkuSecundario(produto),
    })), [data, hasEstoqueFilter, hasSemGrupoFilter, estoqueFilters, grupoFilters]);

  const effectiveFilteredPage = needsCompleteResult
    ? Math.min(filteredPage, Math.max(0, Math.ceil(filteredAll.length / 50) - 1))
    : page;
  const filteredData = needsCompleteResult
    ? filteredAll.slice(effectiveFilteredPage * 50, (effectiveFilteredPage + 1) * 50)
    : filteredAll;
  const visibleCount = needsCompleteResult ? filteredAll.length : (totalCount ?? data.length);
  const visibleHasMore = needsCompleteResult
    ? (effectiveFilteredPage + 1) * 50 < filteredAll.length
    : hasMore;

  const columns = [
    { key: "sku", label: "SKU", hidden: true, sortable: true, serverSortable: true, render: (p: ProdutoTableRow) => (
      <span className="font-mono text-xs font-medium" title="SKU — código comercial (catálogo, vendas)">{p.sku || "—"}</span>
    )},
    // Cód. Interno passa a ser metadado dentro da célula Produto. Mantida
    // como coluna oculta para usuários que quiserem reativá-la em "Colunas".
    { key: "codigo_interno", label: "Cód. Interno", sortable: true, serverSortable: true, hidden: true, render: (p: ProdutoTableRow) => (
      <span className="font-mono text-xs text-muted-foreground" title="Código Interno (ERP) — sequencial PRD/INS">{p.codigo_interno || "—"}</span>
    )},
    { key: "nome", mobilePrimary: true, label: "Produto", sortable: true, serverSortable: true, render: (p: ProdutoTableRow) => {
      const variacoes: string[] = Array.isArray(p.variacoes) ? p.variacoes : [];
      const primeiraVar = variacoes[0];
      const restantes = Math.max(0, variacoes.length - 1);
      const meta: string[] = [];
      if (p.sku) meta.push(`SKU ${p.sku}`);
      else if (p.codigo_interno) meta.push(`Cód. ${p.codigo_interno}`);
      if (primeiraVar) meta.push(`Var. ${primeiraVar}${restantes > 0 ? ` +${restantes}` : ""}`);
      return (
        <div className="min-w-0">
          <span className="font-medium text-sm leading-snug block break-words line-clamp-2">{p.nome}</span>
          {meta.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-mono block break-words line-clamp-2" title={meta.join(" · ")}>
              {meta.join(" · ")}
            </span>
          )}
        </div>
      );
    }},
    { key: "unidade_medida", label: "UN", render: (p: Produto) => (
      <span className="text-xs text-muted-foreground">{p.unidade_medida || "UN"}</span>
    )},
    // Coluna "Variações" desativada por padrão (a primeira variação já aparece na célula Produto).
    // Reativável via "Colunas" para quem precisa ver todas as tags.
    { key: "variacoes", label: "Variações", hidden: true, render: (p: Produto) => {
      const items: string[] = Array.isArray(p.variacoes) ? p.variacoes : [];
      if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
      const visiveis = items.slice(0, 2);
      const restantes = items.length - visiveis.length;
      return (
        <div className="flex flex-wrap items-center gap-1" title={items.join(", ")}>
          {visiveis.map((v, i) => (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border font-medium">{v}</span>
          ))}
          {restantes > 0 && <span className="text-[10px] text-muted-foreground">+{restantes}</span>}
        </div>
      );
    }},
    { key: "estoque_atual", mobileCard: true, label: "Estoque", sortable: true, serverSortable: true, render: (p: Produto) => {
      const situacao = getSituacaoEstoque(p);
      const cfg = situacaoEstoqueConfig[situacao];
      return (
        <div className="space-y-0.5">
          <span className={`font-mono text-sm font-semibold ${cfg.textClass}`}>
            {p.estoque_atual ?? 0}
            <span className="text-[11px] text-muted-foreground ml-1 font-normal">{p.unidade_medida}</span>
          </span>
          {Number(p.estoque_minimo) > 0 ? (
            <p className="text-[10px] text-muted-foreground font-mono leading-none">mín: {p.estoque_minimo}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground leading-none">mínimo não definido</p>
          )}
          {(situacao === "zerado" || situacao === "critico") && (
            <StatusBadge status={cfg.statusBadge} label={cfg.label} className="text-[10px] px-1.5 h-4 mt-0.5" />
          )}
        </div>
      );
    }},
    { key: "preco_venda", mobileCard: true, label: "P. Venda", sortable: true, serverSortable: true, render: (p: Produto) => (
      <span className="font-semibold font-mono text-sm">{formatCurrency(p.preco_venda)}</span>
    )},
    { key: "preco_custo", label: "P. Custo", hidden: true, sortable: true, serverSortable: true, render: (p: Produto) => (
      <span className="font-mono text-sm text-muted-foreground">{formatCurrency(p.preco_custo || 0)}</span>
    )},
    { key: "margem", hidden: true, label: "Markup s/ custo", render: (p: Produto) => {
      const custo = Number(p.preco_custo || 0);
      const venda = Number(p.preco_venda || 0);
      // Estados explícitos para evitar "+R$ 0,00" enganoso.
      if (custo <= 0 && venda <= 0) {
        return <span className="text-[11px] text-muted-foreground italic">sem preço/custo</span>;
      }
      if (custo <= 0) {
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge status="pendente" label="Sem custo" className="text-[10px] px-1.5 h-4 w-fit" />
            <span className="text-[10px] text-muted-foreground">não calculável</span>
          </div>
        );
      }
      if (venda <= 0) {
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge status="pendente" label="Sem preço" className="text-[10px] px-1.5 h-4 w-fit" />
            <span className="text-[10px] text-muted-foreground">não calculável</span>
          </div>
        );
      }
      const margem = (venda / custo - 1) * 100;
      const negativa = margem < 0;
      const lucro = venda - custo;
      return (
        <div className="flex flex-col">
          <span className={`font-mono text-xs font-semibold ${negativa ? "text-destructive" : "text-success"}`}>
            {margem.toFixed(1)}%
          </span>
          <span className={`text-[10px] font-mono ${negativa ? "text-destructive/80" : "text-muted-foreground"}`}>
            {negativa ? "" : "+"}{formatCurrency(lucro)}
          </span>
        </div>
      );
    }},
    { key: "tipo_item", label: "Classificação", hidden: true, render: (p: Produto) => (
      <StatusBadge status={p.tipo_item || "produto"} />
    )},
    { key: "ativo", mobileCard: true, label: "Status", render: (p: Produto) => (
      <StatusBadge status={p.ativo !== false ? "ativo" : "inativo"} className="text-[10px] px-1.5 h-4" />
    )},
    { key: "eh_composto", label: "Tipo", hidden: true, render: (p: Produto) => (
      <StatusBadge status={p.eh_composto ? "composto" : "simples"} />
    )},
  ];

  const semMinimoAtivo = ativoFilters.length === 1 && ativoFilters[0] === "ativo"
    && estoqueFilters.length === 1 && estoqueFilters[0] === "sem_minimo"
    && cadastroFilters.length === 0 && tipoFilters.length === 0
    && tipoItemFilters.length === 0 && grupoFilters.length === 0 && !searchTerm;
  const semPrecoAtivo = ativoFilters.length === 1 && ativoFilters[0] === "ativo"
    && cadastroFilters.length === 1 && cadastroFilters[0] === "sem_preco"
    && estoqueFilters.length === 0 && tipoFilters.length === 0
    && tipoItemFilters.length === 0 && grupoFilters.length === 0 && !searchTerm;
  const togglePendencia = (kind: "sem_minimo" | "sem_preco") => {
    const alreadyActive = kind === "sem_minimo" ? semMinimoAtivo : semPrecoAtivo;
    // Uma única atualização na URL preserva a consistência do filtro e faz
    // o número do cartão corresponder ao universo efetivamente apresentado.
    setFilter({
      q: "", tipo: [], tipoItem: [], grupo: [],
      ativo: alreadyActive ? [] : ["ativo"],
      estoque: !alreadyActive && kind === "sem_minimo" ? ["sem_minimo"] : [],
      cadastro: !alreadyActive && kind === "sem_preco" ? ["sem_preco"] : [],
    });
  };

  const prodActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    ativoFilters.forEach(f => chips.push({ key: "ativo", label: "Status", value: [f], displayValue: f === "ativo" ? "Ativo" : "Inativo" }));
    cadastroFilters.forEach(f => chips.push({ key: "cadastro", label: "Cadastro", value: [f], displayValue: f === "sem_preco" ? "Sem preço de venda" : f }));
    tipoFilters.forEach(f => chips.push({ key: "tipo", label: "Tipo", value: [f], displayValue: f === "simples" ? "Simples" : "Composto" }));
    tipoItemFilters.forEach(f => chips.push({ key: "tipoItem", label: "Classificação", value: [f], displayValue: f === "produto" ? "Produto" : f === "insumo" ? "Insumo" : "Serviço" }));
    estoqueFilters.forEach(f => chips.push({ key: "estoque", label: "Estoque", value: [f], displayValue: situacaoEstoqueConfig[f as SituacaoEstoque]?.label ?? f }));
    grupoFilters.forEach(f => {
      const g = grupos.find(x => x.id === f);
      chips.push({ key: "grupo", label: "Grupo", value: [f], displayValue: g?.nome || "Sem grupo" });
    });
    return chips;
  }, [ativoFilters, cadastroFilters, tipoFilters, tipoItemFilters, estoqueFilters, grupoFilters, grupos]);

  const handleRemoveProdFilter = (key: string, value?: string) => {
    if (key === "ativo") setAtivoFilters(ativoFilters.filter(v => v !== value));
    if (key === "cadastro") setCadastroFilters(cadastroFilters.filter(v => v !== value));
    if (key === "tipo") setTipoFilters(tipoFilters.filter(v => v !== value));
    if (key === "tipoItem") setTipoItemFilters(tipoItemFilters.filter(v => v !== value));
    if (key === "estoque") setEstoqueFilters(estoqueFilters.filter(v => v !== value));
    if (key === "grupo") setGrupoFilters(grupoFilters.filter(v => v !== value));
  };

  const tipoOptions: MultiSelectOption[] = [
    { label: "Simples", value: "simples" },
    { label: "Composto", value: "composto" },
  ];
  const tipoItemOptions: MultiSelectOption[] = [
    { label: "Produto", value: "produto" },
    { label: "Insumo", value: "insumo" },
    { label: "Serviço", value: "servico" },
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
    { label: "Mínimo não definido", value: "sem_minimo" },
  ];
  const cadastroOptions: MultiSelectOption[] = [
    { label: "Sem preço de venda", value: "sem_preco" },
  ];
  const grupoOptions: MultiSelectOption[] = [
    ...grupos.map(g => ({ label: g.nome, value: g.id })),
    { label: "Sem grupo", value: "sem_grupo" },
  ];

  return (
    <ModulePage
      title="Produtos"
      subtitle="Consulta e gestão de produtos"
      addLabel="Novo Produto"
      onAdd={openCreate}
      addButtonHelpId="produtos.novoBtn"
      summaryCards={
        <>
          <SummaryCard
            title="Itens encontrados"
            value={visibleCount}
            icon={Package}
            variant="info"
            density="compact"
          />
          <SummaryCard
            title="Sem estoque mínimo"
            value={qualidade?.semMinimo ?? "—"}
            icon={AlertCircle}
            variant="warning"
            density="compact"
            active={semMinimoAtivo}
            onClick={() => togglePendencia("sem_minimo")}
            subtitle={semMinimoAtivo ? "Filtro ativo · clique para limpar" : "Clique para localizar e corrigir"}
          />
          <SummaryCard
            title="Sem preço de venda"
            value={qualidade?.semPreco ?? "—"}
            icon={Tag}
            variant="warning"
            density="compact"
            active={semPrecoAtivo}
            onClick={() => togglePendencia("sem_preco")}
            subtitle={semPrecoAtivo ? "Filtro ativo · clique para limpar" : "Clique para localizar e corrigir"}
          />
        </>
      }
    >
      <div data-help-id="produtos.filtros">
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Nome, SKU ou código"
          activeFilters={prodActiveFilters}
          onRemoveFilter={handleRemoveProdFilter}
          onClearAll={() => clearFilters(["tipo", "tipoItem", "estoque", "grupo", "ativo", "cadastro"])}
          count={visibleCount}
        >
          <MultiSelect options={ativoOptions} selected={ativoFilters} onChange={setAtivoFilters} placeholder="Status" className="w-[150px]" />
          <MultiSelect options={tipoItemOptions} selected={tipoItemFilters} onChange={setTipoItemFilters} placeholder="Classificação" className="w-[160px]" />
          <MultiSelect options={tipoOptions} selected={tipoFilters} onChange={setTipoFilters} placeholder="Tipo" className="w-[150px]" />
          <MultiSelect options={estoqueOptions} selected={estoqueFilters} onChange={setEstoqueFilters} placeholder="Estoque" className="w-[180px]" />
          <MultiSelect options={grupoOptions} selected={grupoFilters} onChange={setGrupoFilters} placeholder="Grupos" className="w-[200px]" />
          <MultiSelect options={cadastroOptions} selected={cadastroFilters} onChange={setCadastroFilters} placeholder="Pendências" className="w-[180px]" />
        </AdvancedFilterBar>
      </div>

      {truncated && needsCompleteResult && (
        <p role="alert" className="mb-3 text-sm text-destructive">A consulta de produtos atingiu o limite seguro. Refine os filtros para obter uma lista completa.</p>
      )}
      <PullToRefresh onRefresh={fetchData}>
        <div data-help-id="produtos.tabela">
          {isError ? (
            <QueryErrorFallback error={queryError} onRetry={fetchData} />
          ) : (
          <DataTable
            columns={columns}
            data={filteredData}
            loading={loading}
            moduleKey="produtos"
            pageSize={50}
            defaultSortKey="sku"
            showColumnToggle={true}
            onView={openView}
            onEdit={openEdit}
            onDelete={canExcluir ? handleInativar : undefined}
            deleteBehavior="soft"
            mobileIdentifierKey="sku"
            mobileHideIdentifier
            mobileLabeledDetails
            mobileStatusKey="ativo"
            serverPagination={{ page: effectiveFilteredPage, setPage: needsCompleteResult ? setFilteredPage : setPage, totalCount: visibleCount, hasMore: visibleHasMore }}
            onServerSort={sort.onChange}
            serverSortKey={sort.sortKey}
            serverSortDir={sort.sortDir}
            mobileInlineActions={(p: Produto) => (
              <MobileCardActionButton
                icon={Package}
                label="Ver produto"
                onClick={(e) => { e.stopPropagation(); pushView("produto", p.id); }}
                variant="primary"
              />
            )}
          />
          )}
        </div>
      </PullToRefresh>

      <ProdutoFormModal
        open={formOpen}
        mode={formMode}
        produtoId={formProdutoId}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      <MobileQuickAddFAB onClick={() => setQuickAddOpen(true)} label="Novo produto" />
      <QuickAddProductModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => {
          setQuickAddOpen(false);
          fetchData?.();
          toast.success("Produto cadastrado com sucesso");
        }}
      />
    </ModulePage>
  );
};

export default Produtos;
