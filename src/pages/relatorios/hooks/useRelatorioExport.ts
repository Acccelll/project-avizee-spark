/**
 * Concentra as ações de exportação do workspace de Relatórios (CSV / Excel /
 * PDF) e a derivação de `exportColumnDefs` a partir das colunas visíveis.
 *
 * - Mantém o estado `isExporting` único (evita disparos paralelos).
 * - Toasts de progresso/erro padronizados.
 * - `exportScopeDescription` reutilizável em todos os caminhos.
 *
 * Extraído de `Relatorios.tsx` (Fase 5 do roadmap).
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  exportarParaCsv,
  exportarParaExcel,
  exportarParaPdf,
  type ExportColumnDef,
} from '@/services/export.service';
import { reportConfigs } from '@/config/relatoriosConfig';
import type {
  RelatorioResultado,
  TipoRelatorio,
} from '@/services/relatorios.service';

const PDF_ROW_LIMIT = 200;

interface VisibleColumn {
  key: string;
  label: string;
}

interface UseRelatorioExportArgs {
  tipo: TipoRelatorio | '';
  resultado?: RelatorioResultado;
  sortedRows: Record<string, unknown>[];
  visibleColumns: VisibleColumn[];
  empresaConfig: unknown;
  dataInicio: string;
  dataFim: string;
}

export function useRelatorioExport({
  tipo,
  resultado,
  sortedRows,
  visibleColumns,
  empresaConfig,
  dataInicio,
  dataFim,
}: UseRelatorioExportArgs) {
  const [isExporting, setIsExporting] = useState(false);

  const exportScopeDescription = `${sortedRows.length} ${
    sortedRows.length === 1 ? 'registro' : 'registros'
  } · ${visibleColumns.length} ${
    visibleColumns.length === 1 ? 'coluna' : 'colunas'
  }`;

  const exportColumnDefs = useMemo<ExportColumnDef[] | undefined>(() => {
    if (!tipo) return undefined;
    const cfg = reportConfigs[tipo as TipoRelatorio];
    if (!cfg?.columns?.length) return undefined;
    return visibleColumns.map((vc) => {
      const cfgCol = cfg.columns.find((c) => c.key === vc.key);
      return { key: vc.key, label: vc.label, format: cfgCol?.format };
    });
  }, [visibleColumns, tipo]);

  const handleExportCsv = () => {
    if (!sortedRows.length) {
      toast.warning('Nenhum dado visível para exportar.');
      return;
    }
    exportarParaCsv({
      titulo: resultado?.title || String(tipo),
      rows: sortedRows,
      columns: exportColumnDefs,
    });
    toast.success('CSV exportado com sucesso.', { description: exportScopeDescription });
  };

  const handleExportPdf = async () => {
    if (!sortedRows.length) {
      toast.warning('Nenhum dado visível para exportar.');
      return;
    }
    if (isExporting) return;
    if (sortedRows.length > PDF_ROW_LIMIT) {
      toast.warning(
        `PDF limitado a ${PDF_ROW_LIMIT} de ${sortedRows.length} registros. Use Excel para exportação completa.`,
        { duration: 8000 },
      );
    }
    const tid = toast.loading('Gerando PDF...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      await exportarParaPdf({
        titulo: resultado?.title || String(tipo),
        rows: sortedRows,
        columns: exportColumnDefs,
        empresa: empresaConfig,
        dataInicio,
        dataFim,
        resultado,
      });
      toast.success('PDF gerado com sucesso!', {
        id: tid,
        description: exportScopeDescription,
      });
    } catch (e) {
      toast.error('Falha ao gerar PDF.', { id: tid });
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    if (!sortedRows.length) {
      toast.warning('Nenhum dado visível para exportar.');
      return;
    }
    if (isExporting) return;
    const tid = toast.loading('Gerando Excel...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      await exportarParaExcel({
        titulo: resultado?.title || String(tipo),
        rows: sortedRows,
        columns: exportColumnDefs,
      });
      toast.success('Excel gerado com sucesso!', {
        id: tid,
        description: exportScopeDescription,
      });
    } catch (e) {
      toast.error('Falha ao gerar Excel.', { id: tid });
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportColumnDefs,
    exportScopeDescription,
    handleExportCsv,
    handleExportPdf,
    handleExportXlsx,
    PDF_ROW_LIMIT,
  };
}