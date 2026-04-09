import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { SummaryCard } from '@/components/SummaryCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MultiSelect } from "@/components/ui/MultiSelect";
import { DataTable } from '@/components/DataTable';
import { PreviewModal } from '@/components/ui/PreviewModal';
import { cn } from '@/lib/utils';
import { ChevronLeft, Columns, Download, RefreshCcw, Hash, FileText, Eye, FileSpreadsheet, Layers, PieChart as PieChartIcon, LineChart, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell, Legend, LineChart as RechartsLineChart, Line } from 'recharts';
import { carregarRelatorio, exportarCsv, exportarXlsx, formatCellValue, type RelatorioResultado, type TipoRelatorio } from '@/services/relatorios.service';
import { reportConfigs, reportCategoryMeta, type ReportCategory } from '@/config/relatoriosConfig';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Badge value classification constants used in column rendering
const BADGE_CRITICAL_VALUES = ['vencido', 'abaixo do mínimo', 'zerado', 'pendente', 'nf s/ financeiro', 'pedido s/ nf', 'c', 'alta'];
const BADGE_OK_VALUES = ['ok', 'entregue', 'confirmado', 'pago', 'faturado', 'a'];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(0 84% 60%)',
  'hsl(262 83% 58%)',
];

function buildPdf(resultado: RelatorioResultado, dataInicio: string, dataFim: string, empresa?: { razao_social?: string; cnpj?: string; nome_fantasia?: string } | null) {
  return import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    // Company header
    if (empresa?.razao_social) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(empresa.razao_social, margin, y);
      y += 4;
      if (empresa.cnpj) {
        doc.setFont('helvetica', 'normal');
        doc.text(`CNPJ: ${empresa.cnpj}`, margin, y);
        y += 4;
      }
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(resultado.title || 'Relatório', margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(resultado.subtitle || '', margin, y);
    y += 4;
    const periodoText = dataInicio || dataFim
      ? `Período: ${dataInicio || '—'} a ${dataFim || '—'}`
      : `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
    doc.text(periodoText, margin, y);
    y += 8;

    const rows = resultado.rows as Record<string, unknown>[];
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      const colWidth = (pageWidth - margin * 2) / keys.length;

      doc.setFillColor(105, 5, 0);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      keys.forEach((key, i) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        doc.text(label, margin + i * colWidth + 2, y + 5);
      });
      y += 7;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      const maxRows = Math.min(rows.length, 200);
      if (rows.length > 200) {
        y += 10;
        if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bolditalic');
        doc.setTextColor(180, 0, 0);
        doc.text(`⚠ PDF limitado a 200 de ${rows.length} registros. Use "Exportar Excel" para o relatório completo.`, margin, y);
      }
      for (let r = 0; r < maxRows; r++) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 15;
        }
        if (r % 2 === 0) {
          doc.setFillColor(245, 245, 240);
          doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
        }
        keys.forEach((key, i) => {
          const val = String(formatCellValue(rows[r][key], key) ?? '');
          doc.text(val.substring(0, 30), margin + i * colWidth + 2, y + 4);
        });
        y += 6;
      }

      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Total de registros: ${rows.length}`, margin, y);
    }

    return doc;
  });
}

export default function Relatorios() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoInicial = (searchParams.get('tipo') as TipoRelatorio) || 'estoque';
  const [tipo, setTipo] = useState<TipoRelatorio>(tipoInicial);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroClienteIds, setFiltroClienteIds] = useState<string[]>([]);
  const [filtroFornecedorIds, setFiltroFornecedorIds] = useState<string[]>([]);
  const [filtroGrupoIds, setFiltroGrupoIds] = useState<string[]>([]);
  const [filtroTipos, setFiltroTipos] = useState<string[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [agrupamento, setAgrupamento] = useState<string>('padrao');
  const [dreCompetencia, setDreCompetencia] = useState<'mes' | 'trimestre' | 'ano' | 'personalizado'>('mes');
  const [dreMes, setDreMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [clientes, setClientes] = useState<{ id: string; nome_razao_social: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome_razao_social: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RelatorioResultado>({ title: '', subtitle: '', rows: [] });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [empresaConfig, setEmpresaConfig] = useState<{ razao_social?: string; cnpj?: string; nome_fantasia?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nome_razao_social').eq('ativo', true).order('nome_razao_social').limit(300),
      supabase.from('fornecedores').select('id, nome_razao_social').eq('ativo', true).order('nome_razao_social').limit(300),
      supabase.from('grupos_produto').select('id, nome').eq('ativo', true).order('nome'),
    ]).then(([{ data: c }, { data: f }, { data: g }]) => {
      setClientes(c || []);
      setFornecedores(f || []);
      setGrupos(g || []);
    });
  }, []);

  useEffect(() => {
    supabase.from('empresa_config').select('razao_social, cnpj, nome_fantasia').limit(1).single().then(({ data, error }) => {
      if (!error && data) setEmpresaConfig(data as { razao_social?: string; cnpj?: string; nome_fantasia?: string });
    });
  }, []);

  useEffect(() => {
    const tipoQuery = searchParams.get('tipo') as TipoRelatorio | null;
    if (tipoQuery && tipoQuery !== tipo) setTipo(tipoQuery);
  }, [searchParams, tipo]);

  const getDreDateRange = () => {
    if (dreCompetencia === 'personalizado') return { dataInicio, dataFim };
    const now = new Date();
    if (dreCompetencia === 'mes') {
      const [y, m] = dreMes.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      return { dataInicio: start, dataFim: end };
    }
    if (dreCompetencia === 'trimestre') {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
      return { dataInicio: start, dataFim: end };
    }
    return { dataInicio: `${now.getFullYear()}-01-01`, dataFim: `${now.getFullYear()}-12-31` };
  };

  const loadData = async () => {
    setLoading(true);
    setErrorLoading(null);
    try {
      const filtros = tipo === 'dre'
        ? { ...getDreDateRange(), clienteId: undefined, fornecedorId: undefined, grupoProdutoId: undefined }
        : {
          dataInicio,
          dataFim,
          clienteIds: filtroClienteIds.length > 0 ? filtroClienteIds : undefined,
          fornecedorIds: filtroFornecedorIds.length > 0 ? filtroFornecedorIds : undefined,
          grupoProdutoIds: filtroGrupoIds.length > 0 ? filtroGrupoIds : undefined,
          tiposFinanceiros: filtroTipos.length > 0 ? filtroTipos : undefined,
        };
      const report = await carregarRelatorio(tipo, filtros);
      setResultado(report);
    } catch (error: unknown) {
      console.error('[relatorios]', error);
      setErrorLoading('Não foi possível carregar os dados desse relatório. Revise filtros e tente novamente.');
      toast.error('Não foi possível carregar o relatório.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tipo]);

  const isQtyReport = resultado._isQuantityReport === true;
  const isDreReport = resultado._isDreReport === true;

  const filteredRows = useMemo(() => {
    const rows = (resultado.rows || []) as Record<string, unknown>[];
    if (statusFiltro === 'todos') return rows;
    return rows.filter((r) => {
      const status = String(r.status || r.situacao || r.faturamento || '').toLowerCase();
      return status.includes(statusFiltro.toLowerCase());
    });
  }, [resultado.rows, statusFiltro]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    if (agrupamento === 'valor_desc') {
      return rows.sort((a, b) => Number(b.valor || b.valorTotal || 0) - Number(a.valor || a.valorTotal || 0));
    }
    if (agrupamento === 'vencimento') {
      return rows.sort((a, b) => String(a.vencimento || a.data || '').localeCompare(String(b.vencimento || b.data || '')));
    }
    if (agrupamento === 'status') {
      return rows.sort((a, b) => String(a.status || a.situacao || '').localeCompare(String(b.status || b.situacao || ''), 'pt-BR'));
    }
    return rows;
  }, [filteredRows, agrupamento]);

  const kpiCards = useMemo(() => {
    const kpis = resultado.kpis || {};
    const cfg = reportConfigs[tipo];
    if (!cfg) return [];

    const formatKpi = (val: number | undefined, format: 'currency' | 'number' | 'percent') => {
      if (val == null) return '-';
      if (format === 'currency') return formatCurrency(val);
      if (format === 'percent') return `${val.toFixed(1)}%`;
      return formatNumber(val);
    };

    return cfg.kpis.map((kpiDef) => {
      const val = kpis[kpiDef.key] ?? resultado.totals?.[kpiDef.key];
      return {
        title: kpiDef.label,
        value: formatKpi(val, kpiDef.format),
        icon: Hash,
        variation: kpiDef.variation || '',
        variant: kpiDef.variant,
      };
    });
  }, [resultado.kpis, resultado.totals, tipo]);

  const columns = useMemo(() => {
    if (!sortedRows.length) return [];
    const cfg = reportConfigs[tipo];
    const rowKeys = Object.keys(sortedRows[0]);
    const colDefs = cfg?.columns ?? rowKeys.map((k) => ({ key: k, label: k }));
    // Only show columns that actually exist in the data rows
    const visible = colDefs.filter((c) => rowKeys.includes(c.key));

    return visible.map((colDef) => ({
      key: colDef.key,
      label: colDef.label,
      render: (item: Record<string, unknown>): React.ReactNode => {
        const raw = item[colDef.key];
        const fmt = colDef.format;

        // Badge rendering: badge format or status/criticidade/faixa/classe keys
        const isBadgeKey = fmt === 'badge'
          || colDef.key === 'criticidade'
          || colDef.key === 'faixa'
          || colDef.key === 'classe'
          || colDef.key.toLowerCase().includes('status')
          || colDef.key.toLowerCase().includes('situacao');

        if (isBadgeKey && typeof raw === 'string' && raw !== '-') {
          const normalized = raw.toLowerCase();
          const isCritical = BADGE_CRITICAL_VALUES.some((t) => normalized.includes(t));
          const isOk = BADGE_OK_VALUES.some((t) => normalized === t);
          const variant = isCritical ? 'destructive' : isOk ? 'default' : 'secondary';
          return <Badge variant={variant}>{raw}</Badge>;
        }

        if (fmt === 'percent' && typeof raw === 'number') {
          return `${raw.toFixed(1)}%`;
        }

        if (fmt === 'currency' && typeof raw === 'number') {
          return formatCurrency(raw);
        }

        if ((fmt === 'quantity' || fmt === 'number') && typeof raw === 'number') {
          return formatNumber(raw);
        }

        return formatCellValue(raw, colDef.key, isQtyReport) as React.ReactNode;
      },
    }));
  }, [sortedRows, isQtyReport, tipo]);

  const visibleColumns = useMemo(() => columns.filter((col) => !hiddenColumns.includes(col.key)), [columns, hiddenColumns]);

  const handleSelectTipo = (nextTipo: TipoRelatorio) => {
    setFiltroClienteIds([]);
    setFiltroFornecedorIds([]);
    setFiltroGrupoIds([]);
    setFiltroTipos([]);
    setStatusFiltro('todos');
    setAgrupamento('padrao');
    setHiddenColumns([]);
    setTipo(nextTipo);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tipo', nextTipo);
      return next;
    });
  };

  const applyQuickPeriod = (period: 'hoje' | '7d' | '30d' | 'mes') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    if (period === 'hoje') {
      setDataInicio(end);
      setDataFim(end);
      return;
    }
    if (period === '7d') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      setDataInicio(start.toISOString().slice(0, 10));
      setDataFim(end);
      return;
    }
    if (period === '30d') {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      setDataInicio(start.toISOString().slice(0, 10));
      setDataFim(end);
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    setDataInicio(start);
    setDataFim(end);
  };

  const handleExportCsv = () => {
    exportarCsv(resultado.title || tipo, resultado.rows as Record<string, unknown>[]);
    toast.success('Exportação CSV iniciada.');
  };

  const handleExportPdf = async () => {
    if (resultado && resultado.rows.length > 200) {
      toast.warning(`Este relatório tem ${resultado.rows.length} registros. O PDF mostrará apenas os primeiros 200. Use "Exportar Excel" para exportar tudo.`, { duration: 8000 });
    }
    const doc = await buildPdf(resultado, dataInicio, dataFim, empresaConfig);
    doc.save(`${resultado.title || 'relatorio'}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const handleExportXlsx = async () => {
    await exportarXlsx(resultado.title || tipo, resultado.rows as Record<string, unknown>[]);
    toast.success('Excel gerado com sucesso!');
  };

  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? formatDate(dataInicio) : '—'} a ${dataFim ? formatDate(dataFim) : '—'}`
    : new Date().toLocaleDateString('pt-BR');

  // Build grouped report listing from central config
  const groupedReports = useMemo(() => {
    const allConfigs = Object.values(reportConfigs);
    return Object.entries(reportCategoryMeta).map(([category, meta]) => ({
      category: category as ReportCategory,
      ...meta,
      items: allConfigs.filter((r) => r.category === category),
    }));
  }, []);

  const selectedMeta = reportConfigs[tipo];
  const prioritized = Object.values(reportConfigs).filter((r) => r.priority);
  const showEmptyData = !loading && !errorLoading && sortedRows.length === 0;

  const chartType = selectedMeta?.chartType ?? 'bar';
  const usePie = chartType === 'pie';
  const useLine = chartType === 'line';

  return (
    <AppLayout>
      <ModulePage title="Relatórios" subtitle="Análises gerenciais, exportações e visão consolidada por módulo.">
        <div className="space-y-6">
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
                    <button
                      key={card.id}
                      onClick={() => handleSelectTipo(card.id)}
                      className={cn('rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 bg-card', tipo === card.id && 'border-primary bg-primary/5 ring-1 ring-primary/20')}
                    >
                      <div className="flex items-center gap-2">
                        <card.icon className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold leading-tight">{card.title}</p>
                      </div>
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
                        <button
                          key={card.id}
                          onClick={() => handleSelectTipo(card.id)}
                          className={cn('rounded-lg border p-3 text-left transition-all hover:border-primary/30', tipo === card.id ? 'border-primary bg-primary/5' : 'bg-card')}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <card.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{card.title}</span>
                          </div>
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

          {!!tipo && (
          <>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchParams({}); setTipo('' as TipoRelatorio); }}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar para Relatórios
            </Button>
            {selectedMeta && (
              <span className="text-sm text-muted-foreground">
                <selectedMeta.icon className="inline h-3.5 w-3.5 mr-1 text-primary" />
                {selectedMeta.title}
              </span>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {selectedMeta && <selectedMeta.icon className="h-4 w-4 text-primary" />}
                {selectedMeta?.title || 'Relatório'}
              </CardTitle>
              <CardDescription>{selectedMeta?.objective || 'Ajuste filtros, analise KPIs, veja o gráfico e exporte os dados.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map((kpi) => (
                  <SummaryCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} variationType="neutral" variation={kpi.variation} variant={kpi.variant} />
                ))}
              </div>

              <Card>
                <CardContent className="pt-5 pb-4 space-y-4">
                  <div className="flex flex-wrap items-end gap-4">
                    {selectedMeta?.filters.showDateRange && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Data inicial</Label>
                          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 w-[160px]" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Data final</Label>
                          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 w-[160px]" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Períodos rápidos</Label>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => applyQuickPeriod('hoje')}>Hoje</Button>
                            <Button size="sm" variant="outline" onClick={() => applyQuickPeriod('7d')}>7 dias</Button>
                            <Button size="sm" variant="outline" onClick={() => applyQuickPeriod('30d')}>30 dias</Button>
                            <Button size="sm" variant="outline" onClick={() => applyQuickPeriod('mes')}>Mês atual</Button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="flex flex-wrap gap-2 ml-auto">
                      <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5"><RefreshCcw className="h-3.5 w-3.5" />Atualizar</Button>
                      <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!resultado.rows.length} className="gap-1.5"><Eye className="h-3.5 w-3.5" />Visualizar</Button>
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
                                  <Checkbox
                                    checked={!hiddenColumns.includes(col.key)}
                                    onCheckedChange={(checked) => {
                                      setHiddenColumns((prev) =>
                                        checked ? prev.filter((k) => k !== col.key) : [...prev, col.key]
                                      );
                                    }}
                                  />
                                  {col.label}
                                </label>
                              ))}
                            </div>
                            {hiddenColumns.length > 0 && (
                              <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setHiddenColumns([])}>
                                Restaurar padrão
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                      <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5"><FileText className="h-3.5 w-3.5" />PDF</Button>
                      <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!resultado.rows.length} className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</Button>
                      <Button size="sm" onClick={handleExportCsv} className="gap-1.5"><Download className="h-3.5 w-3.5" />CSV</Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-end">
                    {selectedMeta?.filters.showClientes && (
                      <div className="space-y-1">
                        <Label className="text-xs">Clientes</Label>
                        <MultiSelect options={clientes.map((c) => ({ label: c.nome_razao_social, value: c.id }))} selected={filtroClienteIds} onChange={setFiltroClienteIds} placeholder="Todos os clientes" className="w-[250px]" />
                      </div>
                    )}

                    {selectedMeta?.filters.showFornecedores && (
                      <div className="space-y-1">
                        <Label className="text-xs">Fornecedores</Label>
                        <MultiSelect options={fornecedores.map((f) => ({ label: f.nome_razao_social, value: f.id }))} selected={filtroFornecedorIds} onChange={setFiltroFornecedorIds} placeholder="Todos os fornecedores" className="w-[250px]" />
                      </div>
                    )}

                    {selectedMeta?.filters.showGrupos && (
                      <div className="space-y-1">
                        <Label className="text-xs">Grupos de Produto</Label>
                        <MultiSelect options={grupos.map((g) => ({ label: g.nome, value: g.id }))} selected={filtroGrupoIds} onChange={setFiltroGrupoIds} placeholder="Todos os grupos" className="w-[220px]" />
                      </div>
                    )}

                    {selectedMeta?.filters.showStatus && (
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="aberto">Em aberto</SelectItem>
                            <SelectItem value="vencido">Vencido</SelectItem>
                            <SelectItem value="pago">Pago/Confirmado</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">Agrupamento</Label>
                      <Select value={agrupamento} onValueChange={setAgrupamento}>
                        <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="padrao">Padrão do relatório</SelectItem>
                          <SelectItem value="valor_desc">Maior valor primeiro</SelectItem>
                          <SelectItem value="status">Por status</SelectItem>
                          <SelectItem value="vencimento">Por vencimento/data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMeta?.filters.showTipos && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tipos</Label>
                        <MultiSelect
                          options={[{ label: 'A Receber', value: 'receber' }, { label: 'A Pagar', value: 'pagar' }]}
                          selected={filtroTipos}
                          onChange={setFiltroTipos}
                          placeholder="Todos"
                          className="w-[180px]"
                        />
                      </div>
                    )}
                  </div>

                  {selectedMeta?.filters.showDreCompetencia && (
                    <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Competência</Label>
                        <Select value={dreCompetencia} onValueChange={(v: 'mes' | 'trimestre' | 'ano' | 'personalizado') => setDreCompetencia(v)}>
                          <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mes">Mês específico</SelectItem>
                            <SelectItem value="trimestre">Trimestre atual</SelectItem>
                            <SelectItem value="ano">Ano atual</SelectItem>
                            <SelectItem value="personalizado">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {dreCompetencia === 'mes' && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Mês/Ano</Label>
                          <Input type="month" value={dreMes} onChange={(e) => setDreMes(e.target.value)} className="h-9 w-[160px]" />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{resultado.title || 'Relatório'}</CardTitle>
                    <CardDescription>{resultado.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading && <div className="p-6 text-sm text-muted-foreground animate-pulse">Carregando {selectedMeta?.title || 'relatório'}…</div>}
                    {errorLoading && !loading && <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{errorLoading}</div>}

                    {!loading && !errorLoading && isDreReport ? (
                      <div className="p-4">
                        <table className="w-full text-sm">
                          <tbody>
                            {(sortedRows as Array<Record<string, unknown>>).map((row, i) => {
                              const tipoLinha = row.tipo as string | undefined;
                              const valor = row.valor as number | undefined;
                              const linha = row.linha as string | undefined;
                              return (
                                <tr key={i} className={
                                  tipoLinha === 'header' ? 'bg-primary/5 font-bold' :
                                    tipoLinha === 'subtotal' ? 'bg-muted/50 font-semibold border-t' :
                                      tipoLinha === 'resultado' ? 'bg-primary/10 font-bold text-lg border-t-2 border-primary/30' :
                                        'text-muted-foreground'
                                }>
                                  <td className={`px-4 py-3 ${tipoLinha === 'deducao' ? 'pl-8' : ''}`}>{linha}</td>
                                  <td className={`px-4 py-3 text-right font-mono ${(valor ?? 0) < 0 ? 'text-destructive' : ''}`}>{formatCurrency(valor ?? 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {!loading && !errorLoading && !isDreReport && (
                      <>
                        <DataTable
                          columns={visibleColumns}
                          data={sortedRows}
                          loading={loading}
                          moduleKey={`relatorios-${tipo}`}
                          emptyTitle={`Nenhum registro em ${selectedMeta?.title || 'relatório'}`}
                          emptyDescription="Ajuste o período e os filtros para encontrar registros relevantes."
                        />
                        {/* Footer totals row */}
                        {sortedRows.length > 0 && (() => {
                          const footerCols = (selectedMeta?.columns ?? []).filter((c) => c.footerTotal);
                          if (!footerCols.length) return null;
                          return (
                            <div className="border-t bg-muted/30 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-muted-foreground">
                              {footerCols.map((col) => {
                                const total = (sortedRows as Record<string, unknown>[]).reduce((s, r) => s + Number(r[col.key] || 0), 0);
                                const formatted = (col.format === 'currency') ? formatCurrency(total) : formatNumber(total);
                                return (
                                  <span key={col.key}>{col.label}: <span className="text-foreground">{formatted}</span></span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    {showEmptyData && (
                      <div className="px-4 pb-4 text-xs text-muted-foreground">Nenhum dado encontrado para o filtro atual. Exportações permanecem disponíveis.</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">Resumo Visual {useLine ? <LineChart className="h-4 w-4 text-muted-foreground" /> : usePie ? <PieChartIcon className="h-4 w-4 text-muted-foreground" /> : <BarChart3 className="h-4 w-4 text-muted-foreground" />}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(resultado.chartData || []).length > 0 ? (
                      <>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            {useLine ? (
                              <RechartsLineChart data={resultado.chartData}>
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis hide />
                                <Tooltip formatter={(v: number) => isQtyReport ? formatNumber(v) : formatCurrency(v)} />
                                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                              </RechartsLineChart>
                            ) : usePie ? (
                              <PieChart>
                                <Pie data={resultado.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                                  {(resultado.chartData || []).map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                                </Pie>
                                <Legend verticalAlign="bottom" height={36} />
                                <Tooltip formatter={(v: number) => isQtyReport ? formatNumber(v) : formatCurrency(v)} />
                              </PieChart>
                            ) : (
                              <BarChart data={resultado.chartData}>
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis hide />
                                <Tooltip formatter={(v: number) => isQtyReport ? formatNumber(v) : formatCurrency(v)} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>

                        <div className="space-y-2">
                          {(resultado.chartData || []).slice(0, 6).map((item, i) => (
                            <div key={`${item.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="text-sm font-medium">{item.name}</span>
                              </div>
                              <span className="text-sm font-mono font-semibold">{isQtyReport ? formatNumber(item.value) : formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        O resumo gráfico aparecerá conforme o relatório possuir dados consolidados.
                      </div>
                    )}
                  </CardContent>
                </Card>
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
        title={`${resultado.title || 'Relatório'} — Pré-visualização`}
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
            <h2 className="text-lg font-bold text-foreground">{resultado.title}</h2>
            <p className="text-sm text-muted-foreground">{resultado.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">Período: {periodoLabel}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground border-b">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(resultado.rows as Record<string, unknown>[]).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-muted/20' : ''}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-3 py-1.5 border-b border-border/40 text-xs">
                        {formatCellValue(row[col.key], col.key, isQtyReport) as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3 text-sm">
            <span className="font-semibold text-foreground">Total de registros: {resultado.rows.length}</span>
            {resultado.totals && (
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
