import { useMemo, useState, useEffect } from 'react';
import type React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModulePage } from '@/components/ModulePage';
import { SummaryCard } from '@/components/SummaryCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable } from '@/components/DataTable';
import { PreviewModal } from '@/components/ui/PreviewModal';
import { PeriodoFilter } from '@/pages/relatorios/components/Filtros/PeriodoFilter';
import { FiltrosRelatorio, type FiltrosRelatorioState } from '@/pages/relatorios/components/Filtros/FiltrosRelatorio';
import { RelatorioChart } from '@/pages/relatorios/components/Graficos/RelatorioChart';
import { DreTable } from '@/pages/relatorios/components/Tabelas/DreTable';
import { ReportHeader } from '@/pages/relatorios/components/ReportHeader';
import { ExportMenu } from '@/pages/relatorios/components/ExportMenu';
import { ActiveFiltersBar, type ActiveFilterChip } from '@/pages/relatorios/components/ActiveFiltersBar';
import { ReportResultFooter } from '@/pages/relatorios/components/ReportResultFooter';
import { PreviewDocument } from '@/pages/relatorios/components/PreviewDocument';
import { useRelatorio } from '@/pages/relatorios/hooks/useRelatorio';
import { useRelatoriosFiltrosData } from '@/pages/relatorios/hooks/useRelatoriosFiltrosData';
import { useRelatoriosFavoritos } from '@/hooks/useRelatoriosFavoritos';
import { cn } from '@/lib/utils';
import { BookmarkPlus, BookOpen, Columns, Hash, Eye, Layers, Trash2, RefreshCcw, Rows3, SearchX } from 'lucide-react';
import { exportarParaCsv, exportarParaExcel, exportarParaPdf, type ExportColumnDef } from '@/services/export.service';
import { filtrarPorStatus, sortarRows, classifyBadgeTone } from '@/utils/relatorios';
import { reportConfigs, reportCategoryMeta, reportRuntimeSemantics, type ReportCategory } from '@/config/relatoriosConfig';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { formatCellValue, type TipoRelatorio } from '@/services/relatorios.service';
import type { DreRow } from '@/types/relatorios';
import { badgeVariantFromKind } from '@/lib/relatoriosBadges';
import { toast } from 'sonner';

// ─── Legacy badge classification — used only as fallback when a row hasn't
// been migrated to expose `statusKind`/`criticidadeKind`/etc. yet.
// New reports should populate `*Kind` fields in the service layer.
const BADGE_CRITICAL = ['vencido', 'abaixo do mínimo', 'zerado', 'pendente', 'nf s/ financeiro', 'pedido s/ nf', 'c', 'alta'];
const BADGE_OK = ['ok', 'entregue', 'confirmado', 'pago', 'faturado', 'a'];

const DENSITY_KEY = 'relatorios:density';
const PDF_ROW_LIMIT = 200;

function buildDreDateRange(state: FiltrosRelatorioState, dataInicio: string, dataFim: string) {
  if (state.dreCompetencia === 'personalizado') return { dataInicio, dataFim };
  const now = new Date();
  if (state.dreCompetencia === 'mes') {
    const [y, m] = state.dreMes.split('-').map(Number);
    return { dataInicio: `${y}-${String(m).padStart(2, '0')}-01`, dataFim: new Date(y, m, 0).toISOString().slice(0, 10) };
  }
  if (state.dreCompetencia === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    return { dataInicio: new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10), dataFim: new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10) };
  }
  return { dataInicio: `${now.getFullYear()}-01-01`, dataFim: `${now.getFullYear()}-12-31` };
}

export default function Relatorios() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tipo = (searchParams.get('tipo') as TipoRelatorio) || '';
  const dataInicio = searchParams.get('di') || '';
  const dataFim = searchParams.get('df') || '';

  const filtrosState = useMemo<FiltrosRelatorioState>(() => ({
    clienteIds: searchParams.get('cli') ? searchParams.get('cli')!.split(',') : [],
    fornecedorIds: searchParams.get('for') ? searchParams.get('for')!.split(',') : [],
    grupoIds: searchParams.get('grp') ? searchParams.get('grp')!.split(',') : [],
    statusFiltro: searchParams.get('st') || 'todos',
    agrupamento: (searchParams.get('ag') as FiltrosRelatorioState['agrupamento']) || 'padrao',
    tipos: searchParams.get('tp') ? searchParams.get('tp')!.split(',') : [],
    dreCompetencia: (searchParams.get('drc') as FiltrosRelatorioState['dreCompetencia']) || 'mes',
    dreMes: searchParams.get('drm') || new Date().toISOString().slice(0, 7),
  }), [searchParams]);

  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  // ── Density toggle (compact rows) — persisted in localStorage ────────────
  const [compactDensity, setCompactDensity] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DENSITY_KEY) === '1';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DENSITY_KEY, compactDensity ? '1' : '0');
    }
  }, [compactDensity]);

  const { favoritos, salvar: salvarFavorito, remover: removerFavorito } = useRelatoriosFavoritos();

  const updateParams = (patch: Record<string, string | string[] | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) {
          next.delete(k);
        } else {
          next.set(k, Array.isArray(v) ? v.join(',') : v);
        }
      }
      return next;
    });
  };

  const setDataInicio = (v: string) => updateParams({ di: v });
  const setDataFim = (v: string) => updateParams({ df: v });
  const setFiltrosState = (partial: Partial<FiltrosRelatorioState>) => {
    const patch: Record<string, string | string[] | undefined> = {};
    if ('clienteIds' in partial) patch.cli = partial.clienteIds;
    if ('fornecedorIds' in partial) patch.for = partial.fornecedorIds;
    if ('grupoIds' in partial) patch.grp = partial.grupoIds;
    if ('statusFiltro' in partial) patch.st = partial.statusFiltro === 'todos' ? undefined : partial.statusFiltro;
    if ('agrupamento' in partial) patch.ag = partial.agrupamento === 'padrao' ? undefined : partial.agrupamento;
    if ('tipos' in partial) patch.tp = partial.tipos;
    if ('dreCompetencia' in partial) patch.drc = partial.dreCompetencia === 'mes' ? undefined : partial.dreCompetencia;
    if ('dreMes' in partial) patch.drm = partial.dreMes;
    updateParams(patch);
  };

  const { clientes, fornecedores, grupos, empresaConfig, limits } = useRelatoriosFiltrosData();

  const filtros = useMemo(() => {
    if (tipo === 'dre') return buildDreDateRange(filtrosState, dataInicio, dataFim);
    return {
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      clienteIds: filtrosState.clienteIds.length ? filtrosState.clienteIds : undefined,
      fornecedorIds: filtrosState.fornecedorIds.length ? filtrosState.fornecedorIds : undefined,
      grupoProdutoIds: filtrosState.grupoIds.length ? filtrosState.grupoIds : undefined,
      tiposFinanceiros: filtrosState.tipos.length ? filtrosState.tipos : undefined,
    };
  }, [tipo, dataInicio, dataFim, filtrosState]);

  const { data: resultado, isLoading, isError, refetch } = useRelatorio(tipo, filtros);

  const reportMeta = resultado?.meta;
  const isQtyReport = reportMeta?.valueNature === 'quantidade' || resultado?._isQuantityReport === true;
  const isDreReport = reportMeta?.kind === 'dre' || resultado?._isDreReport === true;
  const rows = useMemo(() => (resultado?.rows ?? []) as Record<string, unknown>[], [resultado?.rows]);

  const selectedMeta = tipo ? reportConfigs[tipo as TipoRelatorio] : undefined;
  const semantics = tipo ? reportRuntimeSemantics[tipo as TipoRelatorio] : undefined;
  const filteredRows = useMemo(
    () => filtrarPorStatus(rows, filtrosState.statusFiltro, { statusField: semantics?.statusField }),
    [rows, filtrosState.statusFiltro, semantics?.statusField],
  );
  const sortedRows = useMemo(
    () => sortarRows(filteredRows, filtrosState.agrupamento, { statusField: semantics?.statusField, valueSortField: semantics?.valueSortField, dateSortField: semantics?.dateSortField }),
    [filteredRows, filtrosState.agrupamento, semantics?.statusField, semantics?.valueSortField, semantics?.dateSortField],
  );

  const kpiCards = useMemo(() => {
    if (!resultado || !tipo) return [];
    const cfg = reportConfigs[tipo as TipoRelatorio];
    if (!cfg) return [];
    const kpis = resultado.kpis || {};
    return cfg.kpis.map((def) => {
      const val = kpis[def.key] ?? resultado.totals?.[def.key];
      const formatted = val == null ? '-' : def.format === 'currency' ? formatCurrency(val) : def.format === 'percent' ? `${val.toFixed(1)}%` : formatNumber(val);
      return { title: def.label, value: formatted, icon: Hash, variation: def.variation || '', variant: def.variant };
    });
  }, [resultado, tipo]);

  const columns = useMemo(() => {
    if (!sortedRows.length || !tipo) return [];
    const cfg = reportConfigs[tipo as TipoRelatorio];
    const rowKeys = Object.keys(sortedRows[0]);
    const colDefs = (cfg?.columns ?? rowKeys.map((k) => ({ key: k, label: k }))).filter((c) => rowKeys.includes(c.key));
    return colDefs.map((colDef) => ({
      key: colDef.key,
      label: colDef.label,
      render: (item: Record<string, unknown>): React.ReactNode => {
        const raw = item[colDef.key];
        const fmt = (colDef as { format?: string }).format;
        const isBadgeKey = fmt === 'badge' || ['criticidade', 'faixa', 'classe'].includes(colDef.key)
          || colDef.key.toLowerCase().includes('status') || colDef.key.toLowerCase().includes('situacao');
        if (isBadgeKey && typeof raw === 'string' && raw !== '-') {
          // Prefer structured *Kind field exposed by the service layer.
          const kindKey =
            colDef.key === 'criticidade' ? 'criticidadeKind' :
            colDef.key === 'faixa' ? 'faixaKind' :
            colDef.key === 'classe' ? 'classeKind' :
            colDef.key === 'tipo' ? 'tipoKind' :
            'statusKind';
          const kind = item[kindKey] as string | undefined;
          let variant: 'default' | 'secondary' | 'destructive' | 'outline';
          if (kind) {
            variant = badgeVariantFromKind(kind as Parameters<typeof badgeVariantFromKind>[0]);
          } else {
            // Fallback to legacy text heuristic for un-migrated rows.
            const n = raw.toLowerCase();
            variant = BADGE_CRITICAL.some((t) => n.includes(t)) ? 'destructive' : BADGE_OK.some((t) => n === t) ? 'default' : 'secondary';
          }
          return <Badge variant={variant}>{raw}</Badge>;
        }
        if (fmt === 'percent' && typeof raw === 'number') return `${raw.toFixed(1)}%`;
        if (fmt === 'currency' && typeof raw === 'number') return formatCurrency(raw);
        if ((fmt === 'quantity' || fmt === 'number') && typeof raw === 'number') return formatNumber(raw);
        return formatCellValue(raw, colDef.key, isQtyReport) as React.ReactNode;
      },
    }));
  }, [sortedRows, isQtyReport, tipo]);

  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenColumns.includes(c.key)), [columns, hiddenColumns]);

  const handleSelectTipo = (next: TipoRelatorio) => {
    setHiddenColumns([]);
    setSearchParams({ tipo: next });
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportScopeDescription = `${sortedRows.length} ${sortedRows.length === 1 ? 'registro' : 'registros'} · ${visibleColumns.length} ${visibleColumns.length === 1 ? 'coluna' : 'colunas'}`;

  const handleExportCsv = () => {
    if (!sortedRows.length) { toast.warning('Nenhum dado visível para exportar.'); return; }
    exportarParaCsv({ titulo: resultado?.title || String(tipo), rows: sortedRows, columns: exportColumnDefs });
    toast.success('CSV exportado com sucesso.', { description: exportScopeDescription });
  };
  const handleExportPdf = async () => {
    if (!sortedRows.length) { toast.warning('Nenhum dado visível para exportar.'); return; }
    if (isExporting) return;
    if (sortedRows.length > PDF_ROW_LIMIT) toast.warning(`PDF limitado a ${PDF_ROW_LIMIT} de ${sortedRows.length} registros. Use Excel para exportação completa.`, { duration: 8000 });
    const tid = toast.loading('Gerando PDF...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      await exportarParaPdf({ titulo: resultado?.title || String(tipo), rows: sortedRows, columns: exportColumnDefs, empresa: empresaConfig, dataInicio, dataFim, resultado });
      toast.success('PDF gerado com sucesso!', { id: tid, description: exportScopeDescription });
    } catch (e) {
      toast.error('Falha ao gerar PDF.', { id: tid });
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };
  const handleExportXlsx = async () => {
    if (!sortedRows.length) { toast.warning('Nenhum dado visível para exportar.'); return; }
    if (isExporting) return;
    const tid = toast.loading('Gerando Excel...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      await exportarParaExcel({ titulo: resultado?.title || String(tipo), rows: sortedRows, columns: exportColumnDefs });
      toast.success('Excel gerado com sucesso!', { id: tid, description: exportScopeDescription });
    } catch (e) {
      toast.error('Falha ao gerar Excel.', { id: tid });
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSalvarFavorito = () => {
    const name = saveName.trim();
    if (!name) return;
    const saved = salvarFavorito(name, searchParams);
    setSaveName('');
    setSaveNameOpen(false);
    if (saved) toast.success(`Configuração "${name}" salva com sucesso!`);
    else toast.warning(`Já existe uma configuração com o nome "${name}".`);
  };

  const handleCarregarFavorito = (params: string) => {
    setSearchParams(new URLSearchParams(params));
    setHiddenColumns([]);
    toast.success('Favorito aplicado aos filtros atuais.');
  };

  const handleChartDrillDown = (point: { name: string; value: number }) => {
    if (!tipo) return;
    const drillMap: Partial<Record<TipoRelatorio, TipoRelatorio>> = {
      vendas: 'vendas_cliente',
      faturamento: 'vendas_cliente',
      compras: 'compras_fornecedor',
      curva_abc: 'margem_produtos',
    };
    const target = drillMap[tipo as TipoRelatorio];
    if (target) {
      const next = new URLSearchParams({ tipo: target });
      if (dataInicio) next.set('di', dataInicio);
      if (dataFim) next.set('df', dataFim);
      setSearchParams(next);
    } else {
      const formattedValue = isQtyReport ? formatNumber(point.value) : formatCurrency(point.value);
      toast.info(`Detalhes: ${point.name} — ${formattedValue}`, { duration: 3000 });
    }
  };

  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? formatDate(dataInicio) : '—'} a ${dataFim ? formatDate(dataFim) : '—'}`
    : new Date().toLocaleDateString('pt-BR');

  const groupedReports = useMemo(() => {
    const all = Object.values(reportConfigs);
    return Object.entries(reportCategoryMeta).map(([cat, meta]) => ({
      category: cat as ReportCategory, ...meta, items: all.filter((r) => r.category === cat),
    }));
  }, []);

  const categoryMeta = selectedMeta ? reportCategoryMeta[selectedMeta.category] : undefined;
  const prioritized = Object.values(reportConfigs).filter((r) => r.priority);
  const showEmpty = !isLoading && !isError && sortedRows.length === 0;
  const hasExportableData = sortedRows.length > 0;
  const hasLocalFiltersApplied = rows.length !== sortedRows.length;

  const exportColumnDefs = useMemo<ExportColumnDef[] | undefined>(() => {
    if (!tipo || !selectedMeta) return undefined;
    const cfgCols = selectedMeta.columns;
    if (!cfgCols.length) return undefined;
    return visibleColumns.map((vc) => {
      const cfgCol = cfgCols.find((c) => c.key === vc.key);
      return { key: vc.key, label: vc.label, format: cfgCol?.format };
    });
  }, [visibleColumns, tipo, selectedMeta]);

  // ── Active filter chips ──────────────────────────────────────────────────
  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const out: ActiveFilterChip[] = [];
    if (dataInicio || dataFim) {
      out.push({
        id: 'periodo',
        label: 'Período',
        value: `${dataInicio ? formatDate(dataInicio) : '—'} → ${dataFim ? formatDate(dataFim) : '—'}`,
        tone: semantics?.highlightFilters?.includes('periodo') ? 'relevant' : 'default',
        onRemove: () => updateParams({ di: undefined, df: undefined }),
      });
    }
    if (filtrosState.clienteIds.length) {
      const names = filtrosState.clienteIds
        .map((id) => clientes.find((c) => c.id === id)?.nome_razao_social)
        .filter(Boolean) as string[];
      out.push({
        id: 'cli',
        label: 'Clientes',
        value: names.length === 1 ? names[0] : `${names.length} selecionados`,
        tone: semantics?.highlightFilters?.includes('clientes') ? 'relevant' : 'default',
        onRemove: () => setFiltrosState({ clienteIds: [] }),
      });
    }
    if (filtrosState.fornecedorIds.length) {
      const names = filtrosState.fornecedorIds
        .map((id) => fornecedores.find((f) => f.id === id)?.nome_razao_social)
        .filter(Boolean) as string[];
      out.push({
        id: 'for',
        label: 'Fornecedores',
        value: names.length === 1 ? names[0] : `${names.length} selecionados`,
        tone: semantics?.highlightFilters?.includes('fornecedores') ? 'relevant' : 'default',
        onRemove: () => setFiltrosState({ fornecedorIds: [] }),
      });
    }
    if (filtrosState.grupoIds.length) {
      const names = filtrosState.grupoIds
        .map((id) => grupos.find((g) => g.id === id)?.nome)
        .filter(Boolean) as string[];
      out.push({
        id: 'grp',
        label: 'Grupos',
        value: names.length === 1 ? names[0] : `${names.length} selecionados`,
        tone: semantics?.highlightFilters?.includes('grupos') ? 'relevant' : 'default',
        onRemove: () => setFiltrosState({ grupoIds: [] }),
      });
    }
    if (filtrosState.statusFiltro && filtrosState.statusFiltro !== 'todos') {
      const opt = (selectedMeta?.filters.statusOptions ?? []).find((o) => o.value === filtrosState.statusFiltro);
      out.push({
        id: 'st',
        label: 'Status',
        value: opt?.label ?? filtrosState.statusFiltro,
        tone: semantics?.highlightFilters?.includes('status') ? 'relevant' : 'default',
        onRemove: () => setFiltrosState({ statusFiltro: 'todos' }),
      });
    }
    if (filtrosState.tipos.length) {
      out.push({
        id: 'tp',
        label: 'Tipos',
        value: filtrosState.tipos.join(', '),
        tone: semantics?.highlightFilters?.includes('tipo') ? 'relevant' : 'default',
        onRemove: () => setFiltrosState({ tipos: [] }),
      });
    }
    if (filtrosState.agrupamento && filtrosState.agrupamento !== 'padrao') {
      const labels: Record<string, string> = {
        valor_desc: 'Maior valor',
        status: 'Status',
        vencimento: 'Vencimento',
      };
      out.push({
        id: 'ag',
        label: 'Ordenação',
        value: labels[filtrosState.agrupamento] ?? filtrosState.agrupamento,
        onRemove: () => setFiltrosState({ agrupamento: 'padrao' }),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosState, clientes, fornecedores, grupos, selectedMeta, semantics, dataInicio, dataFim]);

  const handleClearAllFilters = () => {
    // Mantém o tipo de relatório, limpa o restante.
    setSearchParams({ tipo });
    setHiddenColumns([]);
  };

  const footerCols = (selectedMeta?.columns ?? []).filter((c) => c.footerTotal);

  // ── Header secondary actions (Atualizar + Salvar/Carregar favoritos) ─────
  const headerActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => refetch()}
        className="gap-1.5"
        disabled={isLoading}
        aria-label="Atualizar dados do relatório"
      >
        <RefreshCcw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
        Atualizar
      </Button>
      <Popover open={saveNameOpen} onOpenChange={setSaveNameOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" aria-label="Salvar configuração de filtros">
            <BookmarkPlus className="h-3.5 w-3.5" />
            Salvar favorito
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salvar configuração atual</p>
          <Input
            placeholder="Nome da configuração"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarFavorito(); }}
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" className="w-full" onClick={handleSalvarFavorito} disabled={!saveName.trim()}>Salvar</Button>
        </PopoverContent>
      </Popover>
      {favoritos.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" aria-label="Carregar configuração favorita">
              <BookOpen className="h-3.5 w-3.5" />
              Aplicar favorito
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Favoritos salvos</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {favoritos.map((fav) => (
                <div key={fav.id} className="flex items-center justify-between rounded-md hover:bg-muted/50 px-2 py-1.5 gap-2">
                  <button className="flex-1 text-left text-sm truncate" onClick={() => handleCarregarFavorito(fav.params)}>{fav.nome}</button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" aria-label={`Remover favorito "${fav.nome}"`} onClick={() => { removerFavorito(fav.id); toast.success(`"${fav.nome}" removido.`); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );

  return (
    <>
      <ModulePage title="Relatórios" subtitle="Análises gerenciais, exportações e visão consolidada por módulo.">
        <div className="space-y-6">

          {/* ── Report selector ── */}
          {!tipo && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" />Selecione um Relatório</CardTitle>
                <CardDescription>Escolha o contexto de negócio e o relatório desejado para acessar filtros, análises e exportações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-medium mb-2">Relatórios prioritários</p>
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                    {prioritized.map((card) => (
                      <button key={card.id} onClick={() => handleSelectTipo(card.id)} aria-label={`Abrir relatório: ${card.title}`} className={cn('rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 bg-card')}>
                        <div className="flex items-center gap-2"><card.icon className="h-4 w-4 text-primary" /><p className="text-xs font-semibold leading-tight">{card.title}</p></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {groupedReports.map((group) => (
                    <div key={group.category} className="rounded-lg border p-4">
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2"><group.icon className="h-4 w-4 text-muted-foreground" />{group.title}</p>
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                        {group.items.map((card) => (
                          <button key={card.id} onClick={() => handleSelectTipo(card.id)} aria-label={`Abrir relatório: ${card.title}`} className={cn('rounded-lg border p-3 text-left transition-all hover:border-primary/30 bg-card')}>
                            <div className="flex items-center gap-2 mb-1.5"><card.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">{card.title}</span></div>
                            <p className="text-xs text-muted-foreground">{card.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Active report ── */}
          {!!tipo && selectedMeta && (
            <>
              <ReportHeader
                categoryLabel={categoryMeta?.title}
                categoryIcon={categoryMeta?.icon}
                title={selectedMeta.title}
                description={selectedMeta.objective}
                periodLabel={periodoLabel}
                periodAxisLabel={semantics?.periodAxisLabel}
                recordCount={sortedRows.length}
                onBack={() => setSearchParams({})}
                actions={headerActions}
              />

              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map((kpi) => (
                  <SummaryCard
                    key={kpi.title}
                    title={kpi.title}
                    value={kpi.value}
                    icon={kpi.icon}
                    variationType="neutral"
                    variation={hasLocalFiltersApplied ? `${kpi.variation || ''} (universo total)`.trim() : kpi.variation}
                    variant={kpi.variant}
                    density={compactDensity ? 'compact' : 'default'}
                  />
                ))}
              </div>

              {/* ── Filtros + ações de view/export ── */}
              <Card>
                <CardContent className="pt-5 pb-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      {selectedMeta.filters.showDateRange && (
                        <PeriodoFilter
                          dataInicio={dataInicio}
                          dataFim={dataFim}
                          axisLabel={selectedMeta.timeAxis?.label ?? reportMeta?.timeAxis?.label}
                          onChange={({ dataInicio: di, dataFim: df }) => { setDataInicio(di); setDataFim(df); }}
                        />
                      )}
                      <FiltrosRelatorio
                        filters={selectedMeta.filters}
                        state={filtrosState}
                        clientes={clientes}
                        fornecedores={fornecedores}
                        grupos={grupos}
                        semantics={{
                          statusMeaning: semantics?.statusMeaning,
                          typeMeaning: semantics?.typeMeaning,
                          highlightFilters: semantics?.highlightFilters,
                          listLimitHints: { clientes: limits.clientes, fornecedores: limits.fornecedores },
                        }}
                        onChange={(partial) => setFiltrosState(partial)}
                      />
                    </div>

                    {/* Ações: View / Colunas / Densidade / Exportar */}
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                        disabled={!hasExportableData}
                        className="gap-1.5"
                        aria-label="Visualizar pré-impressão do relatório"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Visualizar
                      </Button>
                      {columns.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5" aria-label="Personalizar colunas">
                              <Columns className="h-3.5 w-3.5" />
                              Colunas
                              {hiddenColumns.length > 0 && (
                                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                                  {columns.length - hiddenColumns.length}/{columns.length}
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 p-3">
                            <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Personalizar colunas</p>
                            <div className="space-y-1.5 max-h-60 overflow-y-auto">
                              {columns.map((col) => (
                                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox checked={!hiddenColumns.includes(col.key)} onCheckedChange={(checked) => setHiddenColumns((prev) => checked ? prev.filter((k) => k !== col.key) : [...prev, col.key])} />
                                  {col.label}
                                </label>
                              ))}
                            </div>
                            {hiddenColumns.length > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setHiddenColumns([])}>Restaurar padrão</Button>}
                          </PopoverContent>
                        </Popover>
                      )}
                      <Button
                        variant={compactDensity ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCompactDensity((v) => !v)}
                        className="gap-1.5"
                        aria-label="Alternar densidade compacta"
                        aria-pressed={compactDensity}
                      >
                        <Rows3 className="h-3.5 w-3.5" />
                        Compacto
                      </Button>
                      <ExportMenu
                        recordCount={sortedRows.length}
                        columnCount={visibleColumns.length}
                        disabled={!hasExportableData}
                        loading={isExporting}
                        pdfRowLimitHint={PDF_ROW_LIMIT}
                        onExportPdf={handleExportPdf}
                        onExportExcel={handleExportXlsx}
                        onExportCsv={handleExportCsv}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Resultado: tabela + chart ── */}
              <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{resultado?.title || 'Relatório'}</CardTitle>
                    <CardDescription>{resultado?.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Active filters bar */}
                    {(activeFilterChips.length > 0 || hasExportableData) && (
                      <ActiveFiltersBar
                        chips={activeFilterChips}
                        recordCount={hasExportableData ? sortedRows.length : undefined}
                        onClearAll={activeFilterChips.length > 0 ? handleClearAllFilters : undefined}
                      />
                    )}

                    {isLoading && <div className="p-6 text-sm text-muted-foreground animate-pulse">Carregando {selectedMeta.title}…</div>}
                    {isError && !isLoading && (
                      <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                        Não foi possível carregar os dados desse relatório. Revise filtros e tente novamente.
                      </div>
                    )}
                    {!isLoading && !isError && isDreReport && <DreTable rows={sortedRows as unknown as DreRow[]} />}
                    {!isLoading && !isError && !isDreReport && (
                      <>
                        {hasLocalFiltersApplied && (
                          <div className="border-b bg-warning/5 px-4 py-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Escopo divergente:</span>{' '}
                            tabela mostra {sortedRows.length} de {rows.length} registros.
                            KPIs refletem o universo total do banco; totais abaixo refletem apenas registros visíveis.
                          </div>
                        )}
                        <DataTable
                          columns={visibleColumns}
                          data={sortedRows}
                          loading={isLoading}
                          moduleKey={`relatorios-${tipo}`}
                          onRowClick={semantics?.investigableField ? () => toast.info('Drill-down em preparação. Em breve você poderá abrir o detalhe desta linha.') : undefined}
                          emptyTitle={`Nenhum registro em ${selectedMeta.title}`}
                          emptyDescription="Ajuste o período e os filtros para encontrar registros relevantes."
                        />
                        <ReportResultFooter rows={sortedRows} cols={footerCols.map((c) => ({ ...c, emphasize: c.format === 'currency' }))} />
                      </>
                    )}
                    {showEmpty && (
                      <EmptyState
                        variant="noResults"
                        icon={SearchX}
                        title="Nenhum dado para os filtros atuais"
                        description="Ajuste o período ou remova filtros para encontrar registros. As exportações refletirão o mesmo resultado vazio."
                        action={
                          activeFilterChips.length > 0 ? (
                            <Button variant="outline" size="sm" onClick={handleClearAllFilters} className="gap-1.5">
                              Limpar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    )}
                  </CardContent>
                </Card>

                <RelatorioChart
                  chartData={resultado?.chartData ?? []}
                  chartType={selectedMeta.chartType ?? 'bar'}
                  isQuantityReport={isQtyReport}
                  contextLabel={semantics?.periodAxisLabel ? `Resumo por ${semantics.periodAxisLabel}` : undefined}
                  importance={selectedMeta.chartType === 'pie' ? 'central' : 'complementar'}
                  onDataPointClick={handleChartDrillDown}
                />
              </div>
            </>
          )}
        </div>
      </ModulePage>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${resultado?.title || 'Relatório'} — Pré-visualização`}
        primaryAction={
          <ExportMenu
            recordCount={sortedRows.length}
            columnCount={visibleColumns.length}
            disabled={!hasExportableData}
            loading={isExporting}
            pdfRowLimitHint={PDF_ROW_LIMIT}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportXlsx}
            onExportCsv={handleExportCsv}
          />
        }
      >
        <PreviewDocument
          empresa={empresaConfig}
          reportTitle={resultado?.title || 'Relatório'}
          reportSubtitle={resultado?.subtitle}
          periodLabel={periodoLabel}
          kpis={kpiCards.map((k) => ({ title: k.title, value: k.value }))}
          columns={visibleColumns.map((c) => ({ key: c.key, label: c.label }))}
          rows={sortedRows}
          isQuantityReport={isQtyReport}
          footerCols={footerCols}
          customBody={isDreReport ? <DreTable rows={sortedRows as unknown as DreRow[]} /> : undefined}
        />
      </PreviewModal>
    </>
  );
}
