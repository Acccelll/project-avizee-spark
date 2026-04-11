// @ts-nocheck
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { SummaryCard } from '@/components/SummaryCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataTable } from '@/components/DataTable';
import { PreviewModal } from '@/components/ui/PreviewModal';
import { PeriodoFilter } from '@/pages/relatorios/components/Filtros/PeriodoFilter';
import { FiltrosRelatorio, type FiltrosRelatorioState } from '@/pages/relatorios/components/Filtros/FiltrosRelatorio';
import { RelatorioChart } from '@/pages/relatorios/components/Graficos/RelatorioChart';
import { DreTable } from '@/pages/relatorios/components/Tabelas/DreTable';
import { useRelatorio } from '@/pages/relatorios/hooks/useRelatorio';
import { useRelatoriosFiltrosData } from '@/pages/relatorios/hooks/useRelatoriosFiltrosData';
import { cn } from '@/lib/utils';
import { ChevronLeft, Columns, Download, RefreshCcw, Hash, FileText, Eye, FileSpreadsheet, Layers } from 'lucide-react';
import { exportarParaCsv, exportarParaExcel, exportarParaPdf } from '@/services/export.service';
import { filtrarPorStatus, sortarRows } from '@/utils/relatorios';
import { reportConfigs, reportCategoryMeta, type ReportCategory } from '@/config/relatoriosConfig';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { formatCellValue, type TipoRelatorio } from '@/services/relatorios.service';
import type { DreRow } from '@/types/relatorios';
import { toast } from 'sonner';

// ─── Badge classification constants ──────────────────────────────────────────
const BADGE_CRITICAL = ['vencido', 'abaixo do mínimo', 'zerado', 'pendente', 'nf s/ financeiro', 'pedido s/ nf', 'c', 'alta'];
const BADGE_OK = ['ok', 'entregue', 'confirmado', 'pago', 'faturado', 'a'];

const DEFAULT_FILTROS: FiltrosRelatorioState = {
  clienteIds: [],
  fornecedorIds: [],
  grupoIds: [],
  statusFiltro: 'todos',
  agrupamento: 'padrao',
  tipos: [],
  dreCompetencia: 'mes',
  dreMes: new Date().toISOString().slice(0, 7),
};

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
  const tipoInicial = (searchParams.get('tipo') as TipoRelatorio) || 'vendas';
  const [tipo, setTipo] = useState<TipoRelatorio | ''>(tipoInicial);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtrosState, setFiltrosState] = useState<FiltrosRelatorioState>(DEFAULT_FILTROS);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reference data (cached 30 min)
  const { clientes, fornecedores, grupos, empresaConfig } = useRelatoriosFiltrosData();

  // Assemble query filtros
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

  // Main React Query fetch — replaces loadData/useState/useEffect
  const { data: resultado, isLoading, isError, refetch } = useRelatorio(tipo, filtros);

  const isQtyReport = resultado?._isQuantityReport === true;
  const isDreReport = resultado?._isDreReport === true;
  const rows = (resultado?.rows ?? []) as Record<string, unknown>[];

  const filteredRows = useMemo(() => filtrarPorStatus(rows, filtrosState.statusFiltro), [rows, filtrosState.statusFiltro]);
  const sortedRows = useMemo(() => sortarRows(filteredRows, filtrosState.agrupamento), [filteredRows, filtrosState.agrupamento]);

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
        const fmt = colDef.format;
        const isBadgeKey = fmt === 'badge' || ['criticidade', 'faixa', 'classe'].includes(colDef.key)
          || colDef.key.toLowerCase().includes('status') || colDef.key.toLowerCase().includes('situacao');
        if (isBadgeKey && typeof raw === 'string' && raw !== '-') {
          const n = raw.toLowerCase();
          const variant = BADGE_CRITICAL.some((t) => n.includes(t)) ? 'destructive' : BADGE_OK.some((t) => n === t) ? 'default' : 'secondary';
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
    setFiltrosState(DEFAULT_FILTROS);
    setHiddenColumns([]);
    setTipo(next);
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tipo', next); return n; });
  };

  const handleExportCsv = () => {
    exportarParaCsv({ titulo: resultado?.title || String(tipo), rows });
    toast.success('Exportação CSV iniciada.');
  };
  const handleExportPdf = async () => {
    if (rows.length > 200) toast.warning(`PDF limitado a 200 de ${rows.length} registros. Use Excel para tudo.`, { duration: 8000 });
    await exportarParaPdf({ titulo: resultado?.title || String(tipo), rows, empresa: empresaConfig, dataInicio, dataFim, resultado });
    toast.success('PDF gerado com sucesso!');
  };
  const handleExportXlsx = async () => {
    await exportarParaExcel({ titulo: resultado?.title || String(tipo), rows });
    toast.success('Excel gerado com sucesso!');
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

  const selectedMeta = tipo ? reportConfigs[tipo as TipoRelatorio] : undefined;
  const prioritized = Object.values(reportConfigs).filter((r) => r.priority);
  const showEmpty = !isLoading && !isError && sortedRows.length === 0;

  return (
    <AppLayout>
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
                      <button key={card.id} onClick={() => handleSelectTipo(card.id)} className={cn('rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 bg-card')}>
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
                          <button key={card.id} onClick={() => handleSelectTipo(card.id)} className={cn('rounded-lg border p-3 text-left transition-all hover:border-primary/30 bg-card')}>
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
          {!!tipo && (
            <>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => { setSearchParams({}); setTipo(''); }} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />Voltar para Relatórios
                </Button>
                {selectedMeta && <span className="text-sm text-muted-foreground"><selectedMeta.icon className="inline h-3.5 w-3.5 mr-1 text-primary" />{selectedMeta.title}</span>}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selectedMeta && <selectedMeta.icon className="h-4 w-4 text-primary" />}{selectedMeta?.title || 'Relatório'}
                  </CardTitle>
                  <CardDescription>{selectedMeta?.objective || 'Ajuste filtros, analise KPIs, veja o gráfico e exporte os dados.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {kpiCards.map((kpi) => (
                      <SummaryCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} variationType="neutral" variation={kpi.variation} variant={kpi.variant} />
                    ))}
                  </div>

                  {/* Filter + action bar */}
                  <Card>
                    <CardContent className="pt-5 pb-4 space-y-4">
                      <div className="flex flex-wrap items-end gap-4">
                        {selectedMeta?.filters.showDateRange && (
                          <PeriodoFilter dataInicio={dataInicio} dataFim={dataFim} onChange={({ dataInicio: di, dataFim: df }) => { setDataInicio(di); setDataFim(df); }} />
                        )}
                        <div className="flex flex-wrap gap-2 ml-auto">
                          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCcw className="h-3.5 w-3.5" />Atualizar</Button>
                          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!rows.length} className="gap-1.5"><Eye className="h-3.5 w-3.5" />Visualizar</Button>
                          {columns.length > 0 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5"><Columns className="h-3.5 w-3.5" />Colunas</Button>
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
                          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5"><FileText className="h-3.5 w-3.5" />PDF</Button>
                          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!rows.length} className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</Button>
                          <Button size="sm" onClick={handleExportCsv} className="gap-1.5"><Download className="h-3.5 w-3.5" />CSV</Button>
                        </div>
                      </div>
                      {selectedMeta && (
                        <FiltrosRelatorio
                          filters={selectedMeta.filters}
                          state={filtrosState}
                          clientes={clientes}
                          fornecedores={fornecedores}
                          grupos={grupos}
                          onChange={(partial) => setFiltrosState((prev) => ({ ...prev, ...partial }))}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Data + chart */}
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{resultado?.title || 'Relatório'}</CardTitle>
                        <CardDescription>{resultado?.subtitle}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        {isLoading && <div className="p-6 text-sm text-muted-foreground animate-pulse">Carregando {selectedMeta?.title || 'relatório'}…</div>}
                        {isError && !isLoading && <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os dados desse relatório. Revise filtros e tente novamente.</div>}
                        {!isLoading && !isError && isDreReport && <DreTable rows={sortedRows as DreRow[]} />}
                        {!isLoading && !isError && !isDreReport && (
                          <>
                            <DataTable columns={visibleColumns} data={sortedRows} loading={isLoading} moduleKey={`relatorios-${tipo}`} emptyTitle={`Nenhum registro em ${selectedMeta?.title || 'relatório'}`} emptyDescription="Ajuste o período e os filtros para encontrar registros relevantes." />
                            {sortedRows.length > 0 && (() => {
                              const footerCols = (selectedMeta?.columns ?? []).filter((c) => c.footerTotal);
                              if (!footerCols.length) return null;
                              return (
                                <div className="border-t bg-muted/30 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-muted-foreground">
                                  {footerCols.map((col) => {
                                    const total = sortedRows.reduce((s, r) => s + Number(r[col.key] || 0), 0);
                                    return <span key={col.key}>{col.label}: <span className="text-foreground">{col.format === 'currency' ? formatCurrency(total) : formatNumber(total)}</span></span>;
                                  })}
                                </div>
                              );
                            })()}
                          </>
                        )}
                        {showEmpty && <div className="px-4 pb-4 text-xs text-muted-foreground">Nenhum dado encontrado para o filtro atual. Exportações permanecem disponíveis.</div>}
                      </CardContent>
                    </Card>

                    <RelatorioChart
                      chartData={resultado?.chartData ?? []}
                      chartType={selectedMeta?.chartType ?? 'bar'}
                      isQuantityReport={isQtyReport}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ModulePage>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${resultado?.title || 'Relatório'} — Pré-visualização`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5"><FileText className="h-3.5 w-3.5" />PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExportXlsx} className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</Button>
            <Button size="sm" onClick={handleExportCsv} className="gap-1.5"><Download className="h-3.5 w-3.5" />CSV</Button>
          </>
        }
      >
        <div className="space-y-6 print:space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-foreground">{resultado?.title}</h2>
            <p className="text-sm text-muted-foreground">{resultado?.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">Período: {periodoLabel}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">{visibleColumns.map((col) => <th key={col.key} className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground border-b">{col.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-muted/20' : ''}>
                    {visibleColumns.map((col) => <td key={col.key} className="px-3 py-1.5 border-b border-border/40 text-xs">{formatCellValue(row[col.key], col.key, isQtyReport) as React.ReactNode}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3 text-sm">
            <span className="font-semibold text-foreground">Total de registros: {rows.length}</span>
            {resultado?.totals && (
              <div className="flex flex-wrap gap-4">
                {resultado.totals.totalQtd != null && <span className="font-semibold">Qtd Total: {formatNumber(resultado.totals.totalQtd)}</span>}
                {resultado.totals.totalCusto != null && <span className="font-semibold">Total Custo: {formatCurrency(resultado.totals.totalCusto)}</span>}
                {resultado.totals.totalVenda != null && <span className="font-semibold">Total Venda: {formatCurrency(resultado.totals.totalVenda)}</span>}
                {resultado.totals.totalEntradas != null && <span className="font-semibold">Entradas: {isQtyReport ? formatNumber(resultado.totals.totalEntradas) : formatCurrency(resultado.totals.totalEntradas)}</span>}
                {resultado.totals.totalSaidas != null && <span className="font-semibold">Saídas: {isQtyReport ? formatNumber(resultado.totals.totalSaidas) : formatCurrency(resultado.totals.totalSaidas)}</span>}
                {resultado.totals.totalAjustes != null && <span className="font-semibold">Ajustes: {formatNumber(resultado.totals.totalAjustes)}</span>}
                {resultado.totals.saldoAtual != null && <span className="font-semibold">Saldo Atual: {formatNumber(resultado.totals.saldoAtual)}</span>}
                {resultado.totals.saldoFinal != null && <span className="font-semibold text-primary">Saldo Final: {formatCurrency(resultado.totals.saldoFinal)}</span>}
                {resultado.totals.receitaBruta != null && <span className="font-semibold">Receita Bruta: {formatCurrency(resultado.totals.receitaBruta)}</span>}
                {resultado.totals.receitaLiquida != null && <span className="font-semibold">Receita Líquida: {formatCurrency(resultado.totals.receitaLiquida)}</span>}
                {resultado.totals.resultado != null && <span className={`font-semibold ${resultado.totals.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>Resultado: {formatCurrency(resultado.totals.resultado)}</span>}
              </div>
            )}
          </div>
        </div>
      </PreviewModal>
    </AppLayout>
  );
}
