import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Columns3,
  Filter,
  RotateCcw,
  Download,
  Trash2,
  FileSpreadsheet,
  FileText,
  FileDown,
  ListFilter,
  ChevronsDownUp,
  MoreVertical,
  Pencil,
  Copy,
  ChevronsUpDown as ExpandIcon,
} from 'lucide-react';
import { buildExportFilename } from '@/lib/utils';
import { exportarParaCsv, exportarParaExcel, exportarParaPdf, type ExportColumnDef } from '@/services/export.service';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/ui/content-skeletons';
import { EmptyState } from '@/components/ui/empty-state';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  hidden?: boolean;
  /** Mark as primary field shown in mobile card title */
  mobilePrimary?: boolean;
  /** Mark as secondary/detail field shown in mobile card body */
  mobileCard?: boolean;
  /**
   * Optional accessor for sorting when the column is calculated/rendered
   * and `item[key]` is undefined or not the value to compare.
   * Example: `sortValue: (item) => item.cliente?.nome ?? ''`.
   */
  sortValue?: (item: T) => string | number | null | undefined;
}

type FilterOperator = 'contains' | 'equals' | 'gt' | 'between';
interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  valueTo?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  moduleKey?: string;
  onRowClick?: (item: T) => void;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onDuplicate?: (item: T) => void;
  loading?: boolean;
  pageSize?: number;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  showColumnToggle?: boolean;
  /**
   * Show the legacy internal "Advanced filters" popover.
   * Off by default — pages should use `AdvancedFilterBar` instead to keep a
   * single source of truth for filter state.
   */
  showInternalFilters?: boolean;
  onBatchDelete?: (ids: string[]) => void;
  onBatchStatusChange?: (ids: string[], status: string) => void;
  renderInlineDetails?: (item: T) => React.ReactNode;
  /**
   * Row count threshold above which virtualization is enabled.
   * Below this threshold, rows render normally without virtualization.
   * @default 50
   */
  virtualizeThreshold?: number;
  /**
   * Maximum height (px) of the table body when virtualization is active.
   * @default 600
   */
  maxHeight?: number;
}

type SortDirection = 'asc' | 'desc' | null;

const getStorageKey = (moduleKey: string, suffix: string) => `datatable:${moduleKey}:${suffix}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  moduleKey,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  loading,
  pageSize = 25,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription = 'Tente ajustar os filtros ou adicione um novo registro.',
  showColumnToggle = false,
  showInternalFilters = false,
  onBatchDelete,
  onBatchStatusChange,
  renderInlineDetails,
  virtualizeThreshold = 50,
  maxHeight = 600,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [deleteItem, setDeleteItem] = useState<T | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(() => localStorage.getItem('datatable:skip-delete-confirm') === '1');
  // Estado local do checkbox dentro do dialog: só é persistido em localStorage no Confirmar.
  const [pendingSkipPref, setPendingSkipPref] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'pagination' | 'infinite'>('pagination');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; rules: FilterRule[] }>>([]);
  const [filterName, setFilterName] = useState('');
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set(columns.filter((c) => c.hidden).map((c) => c.key)));
  const hasActions = !!(onView || onEdit || onDelete || onDuplicate || renderInlineDetails);

  // Scroll-shadow + scroll-position: detect horizontal overflow in the table container
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrollX, setHasScrollX] = useState(false);
  const [scrolledX, setScrolledX] = useState(false);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const check = () => setHasScrollX(el.scrollWidth > el.clientWidth);
    const onScroll = () => setScrolledX(el.scrollLeft > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      // el is captured from the closure above and is guaranteed non-null here
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!moduleKey) return;
    const hiddenRaw = localStorage.getItem(getStorageKey(moduleKey, 'columns'));
    const ruleRaw = localStorage.getItem(getStorageKey(moduleKey, 'filters'));
    const savedRaw = localStorage.getItem(getStorageKey(moduleKey, 'saved-filters'));
    const modeRaw = localStorage.getItem(getStorageKey(moduleKey, 'list-mode'));
    if (hiddenRaw) setHiddenKeys(new Set(JSON.parse(hiddenRaw)));
    if (ruleRaw) setRules(JSON.parse(ruleRaw));
    if (savedRaw) setSavedFilters(JSON.parse(savedRaw));
    if (modeRaw === 'infinite' || modeRaw === 'pagination') setViewMode(modeRaw);
  }, [moduleKey]);

  useEffect(() => {
    if (!moduleKey) return;
    localStorage.setItem(getStorageKey(moduleKey, 'columns'), JSON.stringify([...hiddenKeys]));
  }, [hiddenKeys, moduleKey]);

  useEffect(() => {
    if (!moduleKey) return;
    localStorage.setItem(getStorageKey(moduleKey, 'filters'), JSON.stringify(rules));
  }, [rules, moduleKey]);

  useEffect(() => {
    if (!moduleKey) return;
    localStorage.setItem(getStorageKey(moduleKey, 'saved-filters'), JSON.stringify(savedFilters));
  }, [savedFilters, moduleKey]);

  useEffect(() => {
    if (!moduleKey || !user?.id) return;
    try {
      supabase.from('user_preferences' as any).upsert({
        user_id: user.id,
        module_key: moduleKey,
        columns_config: [...hiddenKeys],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_key' }).then(() => {});
    } catch {
      // Fallback silencioso - preferências ficam apenas no estado local
    }
  }, [hiddenKeys, moduleKey, user?.id]);

  const visibleColumns = columns.filter((c) => !hiddenKeys.has(c.key));
  const primaryColumn = visibleColumns[0] || { key: 'id', label: 'ID' };
  const secondaryColumns = visibleColumns.slice(1);

  const toggleColumnVisibility = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyRule = (item: T, rule: FilterRule) => {
    const raw = item[rule.field];
    if (raw === undefined || raw === null) return false;
    const text = String(raw).toLowerCase();
    const value = rule.value.toLowerCase();
    if (rule.operator === 'contains') return text.includes(value);
    if (rule.operator === 'equals') return text === value;
    if (rule.operator === 'gt') return Number(raw) > Number(rule.value);
    if (rule.operator === 'between') return Number(raw) >= Number(rule.value) && Number(raw) <= Number(rule.valueTo || rule.value);
    return true;
  };

  const filteredData = useMemo(() => {
    if (!rules.length) return data;
    return data.filter((item) => rules.every((rule) => applyRule(item, rule)));
  }, [data, rules]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(0);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    const accessor = (item: T): string | number | null | undefined => {
      if (col?.sortValue) return col.sortValue(item);
      return item[sortKey];
    };
    return [...filteredData].sort((a, b) => {
      const aVal = accessor(a);
      const bVal = accessor(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  // Reset page when filters/data shrink the list past the current page.
  useEffect(() => {
    if (currentPage > 0 && currentPage > totalPages - 1) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  const pageData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pagedData = viewMode === 'infinite' ? sortedData.slice(0, visibleCount) : pageData;

  const toggleSelect = useCallback((id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }, [selectedIds, onSelectionChange]);

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    const pageIds = pagedData.map((item) => item.id).filter(Boolean);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    onSelectionChange(allSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  }, [pagedData, selectedIds, onSelectionChange]);

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeCSV = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const stringValue = String(value);
    if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const buildExportRowsChunked = async (
    toastId: string | number,
    format: 'csv' | 'xlsx' | 'pdf',
    chunkSize = 1000,
  ) => {
    const chunks: Array<Record<string, unknown>[]> = [];
    const startedAt = Date.now();

    for (let i = 0; i < sortedData.length; i += chunkSize) {
      const chunk = sortedData.slice(i, i + chunkSize).map((row) => Object.fromEntries(visibleColumns.map((col) => [col.label, row[col.key]])));
      chunks.push(chunk);

      const processed = Math.min(i + chunk.length, sortedData.length);
      const progress = Math.round((processed / sortedData.length) * 100);
      const elapsed = Date.now() - startedAt;
      const shouldShowEta = sortedData.length > 10000 && processed > 0;
      const etaMs = shouldShowEta ? Math.max(0, Math.round((elapsed / processed) * (sortedData.length - processed))) : 0;
      const etaSec = Math.ceil(etaMs / 1000);
      const etaText = shouldShowEta ? ` · ETA ~${etaSec}s` : '';

      toast.loading(`Exportando ${format.toUpperCase()}... ${progress}%${etaText}`, { id: toastId });
      await sleep(0);
    }

    return chunks.flat();
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (sortedData.length === 0) {
      toast.warning('Nenhum dado para exportar.');
      return;
    }
    const toastId = toast.loading(`Iniciando exportação ${format.toUpperCase()}... 0%`);

    try {
      // Build rows keyed by column key (export.service uses key→value mapping)
      const rows = await (async () => {
        const chunks: Array<Record<string, unknown>[]> = [];
        const startedAt = Date.now();
        const chunkSize = 1000;
        for (let i = 0; i < sortedData.length; i += chunkSize) {
          const chunk = sortedData
            .slice(i, i + chunkSize)
            .map((row) => Object.fromEntries(visibleColumns.map((col) => [col.key, row[col.key]])));
          chunks.push(chunk);
          const processed = Math.min(i + chunk.length, sortedData.length);
          const progress = Math.round((processed / sortedData.length) * 100);
          const elapsed = Date.now() - startedAt;
          const showEta = sortedData.length > 10000 && processed > 0;
          const etaMs = showEta ? Math.max(0, Math.round((elapsed / processed) * (sortedData.length - processed))) : 0;
          const etaText = showEta ? ` · ETA ~${Math.ceil(etaMs / 1000)}s` : '';
          toast.loading(`Exportando ${format.toUpperCase()}... ${progress}%${etaText}`, { id: toastId });
          await sleep(0);
        }
        return chunks.flat();
      })();

      const columnsDef: ExportColumnDef[] = visibleColumns.map((c) => ({ key: c.key, label: c.label }));
      const titulo = moduleKey || 'dados';

      if (format === 'csv') {
        exportarParaCsv({ titulo, rows, columns: columnsDef });
        toast.success('Exportação CSV concluída', { id: toastId });
        return;
      }
      if (format === 'xlsx') {
        await exportarParaExcel({ titulo, rows, columns: columnsDef });
        toast.success('Exportação XLSX concluída', { id: toastId });
        return;
      }
      // PDF — use the centralised builder for proper tabular output
      await exportarParaPdf({ titulo, rows, columns: columnsDef });
      toast.success('Exportação PDF concluída', { id: toastId });
    } catch (error) {
      console.error('Erro ao exportar dados', error);
      toast.error(`Falha ao exportar ${format.toUpperCase()}.`, {
        id: toastId,
        action: {
          label: 'Tentar novamente',
          onClick: () => { void exportData(format); },
        },
      });
    }
  };

  const renderActions = (item: T) => (
    <div className="flex items-center gap-1 flex-nowrap">
      {renderInlineDetails && (
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Expandir detalhes" onClick={(e) => { e.stopPropagation(); toggleExpanded(item.id); }}>
            <ExpandIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Detalhes inline</TooltipContent></Tooltip>
      )}
      {onView && (
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Visualizar registro" onClick={(e) => { e.stopPropagation(); onView(item); }}>
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Visualizar</TooltipContent></Tooltip>
      )}
      {onDuplicate && (
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Duplicar registro" onClick={(e) => { e.stopPropagation(); onDuplicate(item); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Duplicar</TooltipContent></Tooltip>
      )}
    </div>
  );

  // Mobile card action menu
  const renderMobileActions = (item: T) => {
    const hasMenu = onView || onDuplicate;
    if (!hasMenu) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Ações" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onView && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(item); }}>
              <Eye className="mr-2 h-4 w-4" /> Visualizar
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(item); }}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Mobile card layout
  const renderMobileCards = () => {
    // Determine which columns to show in cards
    const primaryCol = visibleColumns.find((c) => c.mobilePrimary) ?? visibleColumns[0];
    const cardCols = visibleColumns.filter((c) => c.mobileCard && c.key !== primaryCol?.key);
    // Fallback: if no mobileCard columns tagged, show first 3 non-primary visible columns
    const fallbackCols = visibleColumns.filter((c) => c.key !== primaryCol?.key).slice(0, 3);
    const detailCols = cardCols.length > 0 ? cardCols : fallbackCols;

    return (
      <div className="space-y-2">
        {pagedData.map((item, idx) => (
          <div
            key={item.id ?? `row-${idx}`}
            className={cn(
              'relative rounded-xl border bg-card px-4 py-3 transition-colors active:bg-muted/50',
              selectable && selectedIds.includes(item.id) && 'border-primary bg-primary/5',
              (onRowClick || onView) && 'cursor-pointer',
            )}
            onClick={() => { onRowClick?.(item); }}
            onDoubleClick={onView ? () => onView(item) : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* Primary field */}
                {primaryCol && (
                  <div className="font-medium text-sm leading-snug">
                    {primaryCol.render ? primaryCol.render(item) : item[primaryCol.key]}
                  </div>
                )}
                {/* Detail fields */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {detailCols.map((col) => (
                    <div key={col.key} className="flex items-baseline gap-1 min-w-0">
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {col.label}:
                      </span>
                      <span className="text-xs">
                        {col.render ? col.render(item) : item[col.key] ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                {selectable && (
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Selecionar item"
                  />
                )}
                {renderMobileActions(item)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  };

  const addRule = () => setRules((prev) => [...prev, { id: crypto.randomUUID(), field: columns[0]?.key || 'id', operator: 'contains', value: '' }]);
  const updateRule = (id: string, patch: Partial<FilterRule>) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id));

  return (
    <>
      {/* Toolbar — desktop only */}
      <div className="mb-2 hidden flex-wrap items-center gap-2 justify-between md:flex">
        <div className="flex flex-wrap items-center gap-2">
          {showInternalFilters && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Filter className="h-3.5 w-3.5" />Filtros</Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-3" align="start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Filtros avançados</p>
                  {rules.map((rule) => (
                    <div key={rule.id} className="grid grid-cols-12 gap-1">
                      <Select value={rule.field} onValueChange={(v) => updateRule(rule.id, { field: v })}>
                        <SelectTrigger className="col-span-4 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={rule.operator} onValueChange={(v: FilterOperator) => updateRule(rule.id, { operator: v })}>
                        <SelectTrigger className="col-span-3 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contém</SelectItem>
                          <SelectItem value="equals">É</SelectItem>
                          <SelectItem value="gt">Maior que</SelectItem>
                          <SelectItem value="between">Entre</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="col-span-3 h-8" value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder="valor" />
                      <Button variant="ghost" size="icon" className="col-span-2 h-8" onClick={() => deleteRule(rule.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={addRule}><ListFilter className="h-3.5 w-3.5 mr-1" />Adicionar regra</Button>
                    <Button variant="ghost" size="sm" onClick={() => setRules([])}><RotateCcw className="h-3.5 w-3.5 mr-1" />Limpar</Button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Salvar este filtro" className="h-8" />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!filterName.trim() || !rules.length) return;
                        setSavedFilters((prev) => [...prev, { name: filterName.trim(), rules }]);
                        setFilterName('');
                        toast.success('Filtro salvo com sucesso');
                      }}
                    >Salvar</Button>
                  </div>
                  {savedFilters.length > 0 && (
                    <div className="space-y-1">
                      {savedFilters.map((f) => (
                        <button key={f.name} className="w-full text-left text-xs rounded px-2 py-1 hover:bg-accent" onClick={() => setRules(f.rules)}>{f.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Select value={viewMode} onValueChange={(v: 'pagination' | 'infinite') => { setViewMode(v); if (moduleKey) localStorage.setItem(getStorageKey(moduleKey, 'list-mode'), v); }}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pagination">Paginação</SelectItem>
              <SelectItem value="infinite">Scroll infinito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showColumnToggle && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Columns3 className="h-3.5 w-3.5" />Colunas</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Colunas visíveis</p>
                <div className="space-y-1">
                  {columns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
                      <Checkbox checked={!hiddenKeys.has(col.key)} onCheckedChange={() => toggleColumnVisibility(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setHiddenKeys(new Set(columns.filter((c) => c.hidden).map((c) => c.key)))}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Restaurar padrão
                </Button>
              </PopoverContent>
            </Popover>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Download className="h-3.5 w-3.5" />Exportar</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => exportData('csv')}><FileDown className="mr-2 h-4 w-4" />CSV</Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => exportData('xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => exportData('pdf')}><FileText className="mr-2 h-4 w-4" />PDF</Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {selectable && selectedIds.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-lg border bg-primary/5 px-3 py-2">
          <span className="text-sm">{selectedIds.length} selecionado(s)</span>
          <div className="flex gap-2">
            {onBatchStatusChange && <Button size="sm" variant="outline" onClick={() => onBatchStatusChange(selectedIds, 'confirmado')}>Alterar status</Button>}
            <Button size="sm" variant="outline" onClick={() => exportData('csv')}>Exportar</Button>
            {(onBatchDelete || onDelete) && <Button size="sm" variant="destructive" onClick={() => { if (onBatchDelete) onBatchDelete(selectedIds); else toast.info('Implemente onBatchDelete para exclusão em lote.'); }}>Excluir</Button>}
          </div>
        </div>
      )}

      {/* Mobile: card list */}
      {isMobile ? (
        loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : sortedData.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            {renderMobileCards()}
            <div className="mt-3 flex items-center justify-between px-1 py-2">
              <span className="text-xs text-muted-foreground">
                {viewMode === 'infinite'
                  ? `${Math.min(visibleCount, sortedData.length)} de ${sortedData.length}`
                  : `${currentPage * pageSize + 1}\u2013${Math.min((currentPage + 1) * pageSize, sortedData.length)} de ${sortedData.length}`}
              </span>
              {viewMode === 'infinite' ? (
                <Button variant="ghost" size="sm" disabled={visibleCount >= sortedData.length} onClick={() => setVisibleCount((v) => v + pageSize)}>
                  <ChevronsDownUp className="h-4 w-4 mr-1" />Carregar mais
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </>
        )
      ) : (
        /* Desktop: full table */
        <div className="data-table">
          {loading ? (
            <TableSkeleton rows={6} cols={Math.max(visibleColumns.length, 4)} />
          ) : sortedData.length === 0 ? (
            <EmptyState title={emptyTitle} description={emptyDescription} />
          ) : (
            <>
              {/* "Deslize →" hint — shown only while the table has horizontal overflow and hasn't been scrolled yet */}
              {hasScrollX && !scrolledX && (
                <div className="mb-1 flex items-center justify-end gap-1 text-xs text-muted-foreground/70 md:hidden" aria-hidden="true">
                  <span>Deslize</span>
                  <span className="animate-bounce-x">→</span>
                </div>
              )}
              <div
                ref={tableContainerRef}
                className={cn(
                  'overflow-x-auto',
                  hasScrollX && !scrolledX && 'shadow-[inset_-12px_0_10px_-10px_rgba(0,0,0,0.12)]',
                  hasScrollX && scrolledX && 'shadow-[inset_12px_0_10px_-10px_rgba(0,0,0,0.12),inset_-12px_0_10px_-10px_rgba(0,0,0,0.12)]',
                )}
              >
                <table className="w-full">
                  <thead className={cn(
                    (maxHeight || pagedData.length > 25) && 'sticky top-0 z-10',
                  )}>
                    <tr className="border-b bg-muted/70 backdrop-blur">
                      {hasActions && <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>}
                      {selectable && <th className="w-10 px-3 py-2.5"><Checkbox checked={pagedData.length > 0 && pagedData.every((item) => selectedIds.includes(item.id))} onCheckedChange={toggleSelectAll} /></th>}
                      {visibleColumns.map((col) => (
                        <th key={col.key} className={cn('px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground', col.sortable !== false && 'cursor-pointer hover:text-foreground transition-colors')} onClick={() => col.sortable !== false && handleSort(col.key)}>
                          <div className="flex items-center gap-1.5">{col.label}{col.sortable !== false && <SortIcon colKey={col.key} />}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <VirtualizedOrPlainTbody
                    data={pagedData}
                    useVirtual={pagedData.length > virtualizeThreshold && !hasScrollX}
                    maxHeight={maxHeight}
                    renderRow={(item, idx) => (
                      <>
                        <tr key={item.id ?? `row-${idx}`} onClick={() => onRowClick?.(item)} onDoubleClick={onView ? () => onView(item) : undefined} className={cn('border-b transition-colors last:border-b-0 hover:bg-muted/30', selectable && selectedIds.includes(item.id) && 'bg-primary/5')}>
                          {hasActions && <td className="px-2 py-2.5">{renderActions(item)}</td>}
                          {selectable && <td className="w-10 px-3 py-2.5"><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} onClick={(e) => e.stopPropagation()} /></td>}
                          {visibleColumns.map((col) => <td key={col.key} className="px-4 py-2.5 text-sm whitespace-nowrap">{col.render ? col.render(item) : item[col.key]}</td>)}
                        </tr>
                        {renderInlineDetails && expandedRows.has(item.id) && (
                          <tr key={`detail-${item.id ?? `row-${idx}`}`} className="border-b bg-muted/20"><td colSpan={visibleColumns.length + (hasActions ? 1 : 0) + (selectable ? 1 : 0)} className="px-4 py-3">{renderInlineDetails(item)}</td></tr>
                        )}
                      </>
                    )}
                  />
                </table>
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {viewMode === 'infinite'
                    ? `${Math.min(visibleCount, sortedData.length)} de ${sortedData.length} registros`
                    : `${currentPage * pageSize + 1}\u2013${Math.min((currentPage + 1) * pageSize, sortedData.length)} de ${sortedData.length}`}
                </span>
                {viewMode === 'infinite' ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" disabled={visibleCount >= sortedData.length} onClick={() => setVisibleCount((v) => v + pageSize)}><ChevronsDownUp className="h-4 w-4 mr-1" />Carregar mais</Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => { setDeleteItem(null); setPendingSkipPref(false); }}
        title="Excluir registro"
        description={`Esta ação removerá ${deleteItem?.nome || deleteItem?.numero || 'o registro selecionado'} permanentemente.`}
        onConfirm={() => {
          if (deleteItem && onDelete) {
            // Persiste a preferência só se confirmar.
            if (pendingSkipPref) {
              setSkipDeleteConfirm(true);
              localStorage.setItem('datatable:skip-delete-confirm', '1');
            }
            onDelete(deleteItem);
            setDeleteItem(null);
            setPendingSkipPref(false);
          }
        }}
      >
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={pendingSkipPref} onCheckedChange={(v) => setPendingSkipPref(!!v)} />
          Não perguntar novamente
        </label>
      </ConfirmDialog>
    </>
  );
}

// ── Virtualized or plain tbody ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VirtualizedOrPlainTbody<T extends Record<string, any>>({
  data,
  useVirtual,
  maxHeight,
  renderRow,
}: {
  data: T[];
  useVirtual: boolean;
  maxHeight: number;
  renderRow: (item: T, index: number) => React.ReactNode;
}) {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
    enabled: useVirtual,
  });

  if (!useVirtual) {
    return <tbody>{data.map((item, idx) => renderRow(item, idx))}</tbody>;
  }

  return (
    <tbody
      ref={parentRef}
      style={{ display: 'block', maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
    >
      <tr style={{ height: `${virtualizer.getTotalSize()}px`, display: 'block' }} aria-hidden="true" />
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = data[virtualRow.index];
        return (
          <tr
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <td style={{ display: 'contents' }}>
              {renderRow(item, virtualRow.index)}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
