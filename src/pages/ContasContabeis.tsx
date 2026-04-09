import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { StatCard } from "@/components/StatCard";
import { ContaContabilDrawer } from "@/components/financeiro/ContaContabilDrawer";
import { ContaContabilEditModal } from "@/components/financeiro/ContaContabilEditModal";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FolderTree,
  FileText,
  GitBranch,
  BookOpen,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  Edit,
  PackageOpen,
} from "lucide-react";

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
  natureza: string;
  aceita_lancamento: boolean;
  conta_pai_id: string | null;
  ativo: boolean;
  created_at: string;
}

const NATUREZA_STYLES: Record<string, string> = {
  devedora: "border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30",
  credora:  "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30",
  mista:    "border-violet-500/40 text-violet-700 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-950/30",
};

// ---------------------------------------------------------------------------
// Shared utility: build a depth map from a flat list of hierarchical accounts
// ---------------------------------------------------------------------------
function buildDepthMap(data: ContaContabil[]): Map<string, number> {
  const map = new Map<string, number>();
  const calc = (id: string, visited = new Set<string>()): number => {
    if (map.has(id)) return map.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const conta = data.find(c => c.id === id);
    if (!conta || !conta.conta_pai_id) { map.set(id, 0); return 0; }
    const d = 1 + calc(conta.conta_pai_id, visited);
    map.set(id, d);
    return d;
  };
  data.forEach(c => calc(c.id));
  return map;
}

// ---------------------------------------------------------------------------
// Tree View Component
// ---------------------------------------------------------------------------
const TREE_INDENT_PER_LEVEL = 20;
const TREE_BASE_PADDING = 12;

interface TreeViewProps {
  data: ContaContabil[];
  loading: boolean;
  onView: (c: ContaContabil) => void;
  onEdit: (c: ContaContabil) => void;
}

function ContasTreeView({ data, loading, onView, onEdit }: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Track whether we've applied the initial expansion once data loaded
  const initializedRef = useRef(false);

  // child map
  const childMap = useMemo(() => {
    const map = new Map<string, ContaContabil[]>();
    const sorted = [...data].sort((a, b) => a.codigo.localeCompare(b.codigo));
    sorted.forEach(c => {
      if (c.conta_pai_id) {
        if (!map.has(c.conta_pai_id)) map.set(c.conta_pai_id, []);
        map.get(c.conta_pai_id)!.push(c);
      }
    });
    return map;
  }, [data]);

  // depth map
  const depthMap = useMemo(() => buildDepthMap(data), [data]);

  const roots = useMemo(
    () => [...data].sort((a, b) => a.codigo.localeCompare(b.codigo)).filter(c => !c.conta_pai_id),
    [data]
  );

  // Expand root nodes once data first loads (avoids stale initializer closure)
  useEffect(() => {
    if (initializedRef.current || roots.length === 0) return;
    initializedRef.current = true;
    setExpandedIds(new Set(roots.map(c => c.id)));
  }, [roots]);

  const allIds = useMemo(() => data.map(c => c.id), [data]);
  const parentIds = useMemo(() => new Set(data.filter(c => childMap.has(c.id)).map(c => c.id)), [data, childMap]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpandedIds(new Set(allIds)), [allIds]);
  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 rounded-md bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <PackageOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma conta encontrada</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Cadastre uma nova conta para visualizar a estrutura hierárquica.</p>
      </div>
    );
  }

  const renderNode = (conta: ContaContabil): React.ReactNode => {
    const children = childMap.get(conta.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(conta.id);
    const depth = depthMap.get(conta.id) ?? 0;
    const isSintetica = !conta.aceita_lancamento;

    return (
      <div key={conta.id}>
        <div
          className="group flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/40 transition-colors"
          style={{ paddingLeft: `${depth * TREE_INDENT_PER_LEVEL + TREE_BASE_PADDING}px` }}
        >
          {/* expand/collapse toggle */}
          <button
            type="button"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => hasChildren && toggleExpand(conta.id)}
            aria-label={isExpanded ? "Recolher" : "Expandir"}
            tabIndex={hasChildren ? 0 : -1}
            style={{ visibility: hasChildren ? "visible" : "hidden" }}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
          </button>

          {/* type icon */}
          {isSintetica
            ? <FolderTree className="w-4 h-4 shrink-0 text-primary" />
            : <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
          }

          {/* code */}
          <span className={`font-mono font-semibold text-sm shrink-0 ${isSintetica ? "text-primary" : "text-foreground"}`}>
            {conta.codigo}
          </span>

          {/* description */}
          <span className={`text-sm flex-1 truncate ${isSintetica ? "font-medium" : "text-muted-foreground"}`}>
            {conta.descricao}
          </span>

          {/* level badge */}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 hidden sm:inline-flex">
            Nível {depth + 1}
          </Badge>

          {/* type badge */}
          <Badge
            variant={isSintetica ? "secondary" : "default"}
            className="text-[10px] px-1.5 py-0 shrink-0 hidden md:inline-flex"
          >
            {isSintetica ? "Sintética" : "Analítica"}
          </Badge>

          {/* children count badge (only for parents) */}
          {hasChildren && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 hidden md:inline-flex tabular-nums">
              {children.length} {children.length === 1 ? "subconta" : "subcontas"}
            </Badge>
          )}

          {/* status */}
          <StatusBadge status={conta.ativo ? "Ativo" : "Inativo"} />

          {/* actions (hidden until hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => onView(conta)}
                  aria-label="Visualizar"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visualizar detalhes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => onEdit(conta)}
                  aria-label="Editar"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* children (only when expanded) */}
        {isExpanded && hasChildren && (
          <div>{children.map(child => renderNode(child))}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Tree toolbar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-muted-foreground">
          {parentIds.size} {parentIds.size === 1 ? "grupo" : "grupos"} · {data.length} {data.length === 1 ? "conta" : "contas"} no total
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={expandAll}>
            <ChevronsUpDown className="w-3.5 h-3.5" /> Expandir tudo
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={collapseAll}>
            <ChevronsDownUp className="w-3.5 h-3.5" /> Recolher tudo
          </Button>
        </div>
      </div>

      {/* Tree rows */}
      <div className="rounded-md border bg-card">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
          <div className="w-5 shrink-0" />
          <div className="w-4 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24 shrink-0">Código</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">Descrição</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:block w-16 shrink-0">Nível</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block w-20 shrink-0">Tipo</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block w-24 shrink-0">Subcontas</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-14 shrink-0">Status</span>
          <span className="w-16 shrink-0" />
        </div>
        <div className="py-1">
          {roots.map(root => renderNode(root))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
const ContasContabeis = () => {
  const { data, loading, create, update, remove } = useSupabaseCrud<ContaContabil>({ table: "contas_contabeis" });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<ContaContabil | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");

  // List-view filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [lancamentoFilters, setLancamentoFilters] = useState<string[]>([]);

  const openCreate = () => { setSelected(null); setEditModalOpen(true); };
  const openEdit = (c: ContaContabil) => { setSelected(c); setEditModalOpen(true); };

  const handleSave = async (payload: Partial<ContaContabil>) => {
    try {
      if (selected) {
        await update(selected.id, payload);
      } else {
        await create(payload);
      }
    } catch (err) {
      console.error('[contas-contabeis] erro ao salvar:', err);
      throw err;
    }
  };

  // Depth map (used only in Lista view columns)
  const depthMap = useMemo(() => buildDepthMap(data), [data]);

  const getDepth = (conta: ContaContabil) => depthMap.get(conta.id) ?? 0;

  // Flat sorted list for Lista view
  const flatData = useMemo(
    () => [...data].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [data]
  );

  // Apply search + filters for Lista view
  const filteredData = useMemo(() => {
    return flatData.filter(c => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!c.codigo.toLowerCase().includes(term) && !c.descricao.toLowerCase().includes(term)) return false;
      }
      if (statusFilters.length > 0) {
        const s = c.ativo ? "ativo" : "inativo";
        if (!statusFilters.includes(s)) return false;
      }
      if (tipoFilters.length > 0) {
        const t = c.aceita_lancamento ? "analitica" : "sintetica";
        if (!tipoFilters.includes(t)) return false;
      }
      if (lancamentoFilters.length > 0) {
        const l = c.aceita_lancamento ? "sim" : "nao";
        if (!lancamentoFilters.includes(l)) return false;
      }
      return true;
    });
  }, [flatData, searchTerm, statusFilters, tipoFilters, lancamentoFilters]);

  // Summary stats
  const totalContas = data.length;
  const totalAnaliticas = useMemo(() => data.filter(c => c.aceita_lancamento).length, [data]);
  const totalSinteticas = useMemo(() => data.filter(c => !c.aceita_lancamento).length, [data]);
  const totalAtivas = useMemo(() => data.filter(c => c.ativo).length, [data]);

  // Filter options
  const statusOptions: MultiSelectOption[] = [
    { label: "Ativa", value: "ativo" },
    { label: "Inativa", value: "inativo" },
  ];
  const tipoOptions: MultiSelectOption[] = [
    { label: "Analítica", value: "analitica" },
    { label: "Sintética", value: "sintetica" },
  ];
  const lancamentoOptions: MultiSelectOption[] = [
    { label: "Aceita", value: "sim" },
    { label: "Não aceita", value: "nao" },
  ];

  // Active filter chips
  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach(f => chips.push({ key: "status", label: "Status", value: [f], displayValue: f === "ativo" ? "Ativa" : "Inativa" }));
    tipoFilters.forEach(f => chips.push({ key: "tipo", label: "Tipo", value: [f], displayValue: f === "analitica" ? "Analítica" : "Sintética" }));
    lancamentoFilters.forEach(f => chips.push({ key: "lancamento", label: "Lançamento", value: [f], displayValue: f === "sim" ? "Aceita" : "Não aceita" }));
    return chips;
  }, [statusFilters, tipoFilters, lancamentoFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "tipo") setTipoFilters(prev => prev.filter(v => v !== value));
    if (key === "lancamento") setLancamentoFilters(prev => prev.filter(v => v !== value));
  };

  // Columns for Lista view (flat — no indentation)
  const columns = [
    {
      key: "codigo",
      label: "Código",
      sortable: true,
      render: (c: ContaContabil) => {
        const isSintetica = !c.aceita_lancamento;
        return (
          <div className="flex items-center gap-1.5">
            {isSintetica
              ? <FolderTree className="w-3.5 h-3.5 shrink-0 text-primary" />
              : <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
            <span className={`font-mono font-semibold text-sm ${isSintetica ? "text-primary" : "text-foreground"}`}>
              {c.codigo}
            </span>
          </div>
        );
      },
    },
    {
      key: "descricao",
      label: "Descrição",
      sortable: true,
      render: (c: ContaContabil) => (
        <span className={!c.aceita_lancamento ? "font-semibold" : ""}>{c.descricao}</span>
      ),
    },
    {
      key: "natureza",
      label: "Natureza",
      render: (c: ContaContabil) => {
        const style = NATUREZA_STYLES[c.natureza?.toLowerCase()] ?? "border-border text-muted-foreground";
        return (
          <Badge variant="outline" className={`text-xs capitalize ${style}`}>
            {c.natureza}
          </Badge>
        );
      },
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (c: ContaContabil) => (
        <Badge
          variant={c.aceita_lancamento ? "default" : "secondary"}
          className={`text-xs ${c.aceita_lancamento ? "" : "bg-muted text-muted-foreground"}`}
        >
          {c.aceita_lancamento ? "Analítica" : "Sintética"}
        </Badge>
      ),
    },
    {
      key: "aceita_lancamento",
      label: "Lançamento",
      render: (c: ContaContabil) =>
        c.aceita_lancamento ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aceita
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <XCircle className="w-3.5 h-3.5" /> Não aceita
          </span>
        ),
    },
    {
      key: "conta_pai",
      label: "Conta Pai",
      hidden: true,
      render: (c: ContaContabil) => {
        if (!c.conta_pai_id) return <span className="text-xs text-muted-foreground">—</span>;
        const pai = data.find(d => d.id === c.conta_pai_id);
        return pai ? (
          <span className="font-mono text-xs text-muted-foreground">{pai.codigo} · {pai.descricao}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "nivel",
      label: "Nível",
      hidden: true,
      render: (c: ContaContabil) => {
        const d = getDepth(c);
        return <span className="font-mono text-xs text-muted-foreground">{d + 1}</span>;
      },
    },
    {
      key: "filhas",
      label: "Subcontas",
      render: (c: ContaContabil) => {
        const count = data.filter(d => d.conta_pai_id === c.id).length;
        return count > 0
          ? <span className="text-xs font-medium tabular-nums">{count}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "ativo",
      label: "Status",
      render: (c: ContaContabil) => <StatusBadge status={c.ativo ? "Ativo" : "Inativo"} />,
    },
  ];

  // Tab toggle (shared between both views)
  const viewToggle = (
    <div className="flex gap-1 rounded-md border p-0.5 bg-muted/40">
      <Button
        size="sm"
        variant={viewMode === "tree" ? "default" : "ghost"}
        onClick={() => setViewMode("tree")}
        className="h-7 gap-1.5 px-3 text-xs"
      >
        <FolderTree className="w-3.5 h-3.5" />
        Árvore
      </Button>
      <Button
        size="sm"
        variant={viewMode === "flat" ? "default" : "ghost"}
        onClick={() => setViewMode("flat")}
        className="h-7 gap-1.5 px-3 text-xs"
      >
        <FileText className="w-3.5 h-3.5" />
        Lista
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <ModulePage
        title="Plano de Contas"
        subtitle="Estrutura hierárquica e operacional de contas contábeis"
        addLabel="Nova Conta"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total de Contas" value={String(totalContas)} icon={BookOpen} />
            <StatCard title="Analíticas" value={String(totalAnaliticas)} icon={FileText} iconColor="text-foreground" />
            <StatCard title="Sintéticas" value={String(totalSinteticas)} icon={FolderTree} iconColor="text-primary" />
            <StatCard title="Ativas" value={String(totalAtivas)} icon={GitBranch} iconColor="text-success" />
          </>
        }
      >
        {/* ── Árvore: visão estrutural/hierárquica ─────────────────────── */}
        {viewMode === "tree" && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Visão Estrutural</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Navegue pela hierarquia de grupos e subcontas. Use para entender a estrutura do plano de contas.
                </p>
              </div>
              {viewToggle}
            </div>
            <ContasTreeView
              data={data}
              loading={loading}
              onView={(c) => { setSelected(c); setDrawerOpen(true); }}
              onEdit={openEdit}
            />
          </>
        )}

        {/* ── Lista: visão operacional/filtrável ───────────────────────── */}
        {viewMode === "flat" && (
          <>
            <AdvancedFilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por código ou descrição..."
              activeFilters={activeFilters}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={() => { setStatusFilters([]); setTipoFilters([]); setLancamentoFilters([]); }}
              count={filteredData.length}
              extra={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden lg:block">
                    Busca rápida, filtros e edição
                  </span>
                  {viewToggle}
                </div>
              }
            >
              <MultiSelect
                options={statusOptions}
                selected={statusFilters}
                onChange={setStatusFilters}
                placeholder="Status"
                className="w-[130px]"
              />
              <MultiSelect
                options={tipoOptions}
                selected={tipoFilters}
                onChange={setTipoFilters}
                placeholder="Tipo"
                className="w-[140px]"
              />
              <MultiSelect
                options={lancamentoOptions}
                selected={lancamentoFilters}
                onChange={setLancamentoFilters}
                placeholder="Lançamento"
                className="w-[150px]"
              />
            </AdvancedFilterBar>

            <DataTable
              columns={columns}
              data={filteredData}
              loading={loading}
              moduleKey="contas-contabeis"
              showColumnToggle={true}
              onView={(c) => { setSelected(c); setDrawerOpen(true); }}
              onEdit={openEdit}
              onDelete={(c) => remove(c.id)}
              emptyTitle="Nenhuma conta encontrada"
              emptyDescription="Tente ajustar os filtros ou cadastre uma nova conta contábil."
            />
          </>
        )}
      </ModulePage>

      <ContaContabilEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        conta={selected}
        allContas={data}
        onSave={handleSave}
      />

      <ContaContabilDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        allContas={data}
        onEdit={(c) => { setDrawerOpen(false); openEdit(c); }}
        onDelete={(c) => remove(c.id)}
      />
    </AppLayout>
  );
};

export default ContasContabeis;
