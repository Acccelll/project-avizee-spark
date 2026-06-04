import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PeriodoFilter } from '@/pages/relatorios/components/Filtros/PeriodoFilter';
import { FiltrosRelatorio, type FiltrosRelatorioState } from '@/pages/relatorios/components/Filtros/FiltrosRelatorio';
import { ExportMenu } from '@/pages/relatorios/components/ExportMenu';
import { Columns, Eye, Rows3, Columns2, SlidersHorizontal, ChevronsUpDown } from 'lucide-react';
import type { ReportConfig, ReportRuntimeSemantics } from '@/config/relatoriosConfig';
import type { ReportMeta } from '@/types/relatorios';
import type { ClienteRef, FornecedorRef, GrupoProdutoRef } from '@/pages/relatorios/hooks/useRelatoriosFiltrosData';

export interface RelatorioColumnDef {
  key: string;
  label: string;
}

interface Props {
  selectedMeta: ReportConfig;
  reportMeta: ReportMeta | undefined;
  semantics: ReportRuntimeSemantics | undefined;
  isDreReport: boolean;
  dataInicio: string;
  dataFim: string;
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  setPeriodo?: (range: { dataInicio: string; dataFim: string }) => void;
  filtrosState: FiltrosRelatorioState;
  setFiltrosState: (partial: Partial<FiltrosRelatorioState>) => void;
  clientes: ClienteRef[];
  fornecedores: FornecedorRef[];
  grupos: GrupoProdutoRef[];
  limits: { clientes: number; fornecedores: number };

  columns: RelatorioColumnDef[];
  visibleColumnsCount: number;
  hiddenColumns: string[];
  setHiddenColumns: (next: string[] | ((prev: string[]) => string[])) => void;

  compactDensity: boolean;
  setCompactDensity: (next: boolean | ((prev: boolean) => boolean)) => void;

  onPreview: () => void;
  hasExportableData: boolean;

  exportMenu: ReactNode;
  /** Item 3 — layout do resultado (gráfico+tabela). */
  layout?: 'stacked' | 'side-by-side';
  onToggleLayout?: () => void;
  /** Item 8 — contagem para indicar filtros ativos quando barra colapsada. */
  activeFiltersCount?: number;
}

/**
 * Barra de filtros desktop (≥md): período + filtros canônicos do relatório à
 * esquerda; ações (Visualizar / Colunas / Densidade / Exportar) à direita.
 * Mantém todo o comportamento original de Relatorios.tsx mas isolado em uma
 * unidade testável e enxuta.
 */
export function RelatorioFiltrosBar({
  selectedMeta,
  reportMeta,
  semantics,
  isDreReport,
  dataInicio,
  dataFim,
  setDataInicio,
  setDataFim,
  setPeriodo,
  filtrosState,
  setFiltrosState,
  clientes,
  fornecedores,
  grupos,
  limits,
  columns,
  visibleColumnsCount,
  hiddenColumns,
  setHiddenColumns,
  compactDensity,
  setCompactDensity,
  onPreview,
  hasExportableData,
  exportMenu,
  layout,
  onToggleLayout,
  activeFiltersCount = 0,
}: Props) {
  const [filtersVisible, setFiltersVisible] = useState(true);
  return (
    <Card className="hidden md:block">
      <CardContent className="pt-5 pb-4 space-y-4">
        <Collapsible open={filtersVisible} onOpenChange={setFiltersVisible}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                {!filtersVisible && activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              disabled={!hasExportableData}
              className="gap-1.5"
              aria-label="Visualizar pré-impressão do relatório"
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar
            </Button>
            {columns.length > 0 && !isDreReport && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" aria-label="Personalizar colunas">
                    <Columns className="h-3.5 w-3.5" />
                    Colunas
                    {hiddenColumns.length > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                        {visibleColumnsCount}/{columns.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Personalizar colunas</p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {columns.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!hiddenColumns.includes(col.key)}
                          onCheckedChange={(checked) =>
                            setHiddenColumns((prev) =>
                              checked ? prev.filter((k) => k !== col.key) : [...prev, col.key],
                            )
                          }
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
            {onToggleLayout && (
              <Button
                variant={layout === 'side-by-side' ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleLayout}
                className="gap-1.5"
                aria-label="Alternar layout entre empilhado e lado a lado"
                aria-pressed={layout === 'side-by-side'}
              >
                <Columns2 className="h-3.5 w-3.5" />
                {layout === 'side-by-side' ? 'Empilhado' : 'Lado a lado'}
              </Button>
            )}
            {exportMenu}
            </div>
          </div>
          <CollapsibleContent className="space-y-3 pt-4">
            {selectedMeta.filters.showDateRange && (
              <PeriodoFilter
                dataInicio={dataInicio}
                dataFim={dataFim}
                axisLabel={selectedMeta.timeAxis?.label ?? reportMeta?.timeAxis?.label}
                onChange={({ dataInicio: di, dataFim: df }) => {
                  // Atualiza ambos em uma única chamada — chamadas sequenciais
                  // perdem o `di` porque setSearchParams captura o searchParams
                  // do closure (ver useRelatorioUrlState.setPeriodo).
                  if (setPeriodo) setPeriodo({ dataInicio: di, dataFim: df });
                  else { setDataInicio(di); setDataFim(df); }
                }}
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
              hideAgrupamento={isDreReport}
              onChange={(partial) => setFiltrosState(partial)}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// Re-export ExportMenu for convenience callers.
export { ExportMenu };