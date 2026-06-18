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
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
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
import { exportarXmlsZip } from '@/services/fiscal/xmlBatchExport';
import type { XmlArquivadoRow } from '@/types/relatorios-xml';
import { logger } from "@/lib/logger";

const PDF_ROW_LIMIT = 200;
const XLSX_ROW_LIMIT = 10000;
const CSV_ROW_LIMIT = 50000;
const SUPABASE_PAGE_LIMIT = 1000;

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
  const { confirm: confirmCsv, dialog: dialogCsv } = useConfirmDialog();
  const { confirm: confirmPdf, dialog: dialogPdf } = useConfirmDialog();
  const { confirm: confirmXlsx, dialog: dialogXlsx } = useConfirmDialog();
  const { confirm: confirmZip, dialog: dialogZip } = useConfirmDialog();

  const exportScopeDescription = `${sortedRows.length} ${
    sortedRows.length === 1 ? 'registro' : 'registros'
  } · ${visibleColumns.length} ${
    visibleColumns.length === 1 ? 'coluna' : 'colunas'
  }`;

  // Detecta possível truncamento na origem dos dados (limite default 1000 do Supabase).
  const isLikelyTruncated = sortedRows.length === SUPABASE_PAGE_LIMIT;

  const exportColumnDefs = useMemo<ExportColumnDef[] | undefined>(() => {
    if (!tipo) return undefined;
    const cfg = reportConfigs[tipo as TipoRelatorio];
    if (!cfg?.columns?.length) return undefined;
    return visibleColumns.map((vc) => {
      const cfgCol = cfg.columns.find((c) => c.key === vc.key);
      return { key: vc.key, label: vc.label, format: cfgCol?.format };
    });
  }, [visibleColumns, tipo]);

  const handleExportCsv = async () => {
    if (!sortedRows.length) {
      toast.warning('Nenhum dado visível para exportar.');
      return;
    }
    if (sortedRows.length > CSV_ROW_LIMIT) {
      const ok = await confirmCsv({
        title: `CSV com ${sortedRows.length.toLocaleString('pt-BR')} linhas`,
        description: `Este relatório tem ${sortedRows.length.toLocaleString('pt-BR')} registros (limite recomendado: ${CSV_ROW_LIMIT.toLocaleString('pt-BR')}). O arquivo pode ser grande. Deseja continuar?`,
        confirmLabel: 'Gerar CSV',
      });
      if (!ok) return;
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
      const ok = await confirmPdf({
        title: `PDF parcial — ${sortedRows.length.toLocaleString('pt-BR')} registros`,
        description: `O PDF exibe no máximo ${PDF_ROW_LIMIT} linhas. Este relatório tem ${sortedRows.length.toLocaleString('pt-BR')} registros — ${(sortedRows.length - PDF_ROW_LIMIT).toLocaleString('pt-BR')} não serão incluídos. Para o relatório completo, use Excel.`,
        confirmLabel: 'Gerar PDF parcial',
      });
      if (!ok) {
        void handleExportXlsx();
        return;
      }
    }
    // 9.5 — MB-05: feedback de progresso em fases.
    const tid = toast.loading('Preparando dados...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      toast.loading('Montando PDF...', { id: tid, description: exportScopeDescription });
      await exportarParaPdf({
        titulo: resultado?.title || String(tipo),
        rows: sortedRows,
        columns: exportColumnDefs,
        empresa: empresaConfig,
        dataInicio,
        dataFim,
        resultado,
        origem: {
          modo: 'dinâmico',
          fonte: tipo ? `relatorio:${tipo}` : undefined,
          geradoEm: new Date().toISOString(),
        },
      });
      toast.success('PDF gerado com sucesso!', {
        id: tid,
        description: exportScopeDescription,
      });
    } catch (e) {
      toast.error('Falha ao gerar PDF.', { id: tid });
      logger.error(e);
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
    if (sortedRows.length > XLSX_ROW_LIMIT) {
      const ok = await confirmXlsx({
        title: `Excel com ${sortedRows.length.toLocaleString('pt-BR')} linhas`,
        description: `Este arquivo Excel terá ${sortedRows.length.toLocaleString('pt-BR')} linhas (limite recomendado: ${XLSX_ROW_LIMIT.toLocaleString('pt-BR')}). Pode demorar para abrir em computadores mais lentos.`,
        confirmLabel: 'Gerar Excel',
      });
      if (!ok) return;
    }
    // 9.5 — MB-05: feedback de progresso em fases.
    const tid = toast.loading('Preparando dados...', { description: exportScopeDescription });
    setIsExporting(true);
    try {
      toast.loading('Montando planilha...', { id: tid, description: exportScopeDescription });
      await exportarParaExcel({
        titulo: resultado?.title || String(tipo),
        rows: sortedRows,
        columns: exportColumnDefs,
        origem: {
          modo: 'dinâmico',
          fonte: tipo ? `relatorio:${tipo}` : undefined,
          geradoEm: new Date().toISOString(),
        },
      });
      toast.success('Excel gerado com sucesso!', {
        id: tid,
        description: exportScopeDescription,
      });
    } catch (e) {
      toast.error('Falha ao gerar Excel.', { id: tid });
      logger.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // ── XMLs (.zip) — específico para o relatório "xmls_arquivados" ──────────
  const xmlZipRows = (sortedRows as unknown as XmlArquivadoRow[]).filter(
    (r) => !!r?.caminhoXml,
  );
  const xmlZipCount = tipo === 'xmls_arquivados' ? xmlZipRows.length : 0;

  const handleExportXmlZip = async () => {
    if (tipo !== 'xmls_arquivados') return;
    if (!xmlZipRows.length) {
      toast.warning('Nenhum XML arquivado nas linhas filtradas.');
      return;
    }
    if (isExporting) return;
    if (xmlZipRows.length > 500) {
      const ok = await confirmZip({
        title: `Compactar ${xmlZipRows.length} XMLs`,
        description: `Você está prestes a baixar um .zip com ${xmlZipRows.length.toLocaleString('pt-BR')} arquivos XML. O processo pode levar alguns minutos. Deseja continuar?`,
        confirmLabel: 'Gerar .zip',
      });
      if (!ok) return;
    }
    const tid = toast.loading('Coletando XMLs...', {
      description: `${xmlZipRows.length} arquivos`,
    });
    setIsExporting(true);
    try {
      const result = await exportarXmlsZip({
        rows: xmlZipRows,
        dataInicio,
        dataFim,
        onProgress: (p) => {
          if (p.phase === 'coletando') {
            toast.loading(`Coletando XMLs ${p.current}/${p.total}...`, { id: tid });
          } else if (p.phase === 'compactando') {
            toast.loading('Compactando .zip...', { id: tid });
          }
        },
      });
      const extra = result.falhas
        ? ` · ${result.falhas} falha${result.falhas === 1 ? '' : 's'}`
        : '';
      toast.success(`${result.arquivos} XML${result.arquivos === 1 ? '' : 's'} exportados${extra}`, {
        id: tid,
        description: result.filename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar .zip';
      toast.error(msg, { id: tid });
      logger.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportColumnDefs,
    exportScopeDescription,
    isLikelyTruncated,
    handleExportCsv,
    handleExportPdf,
    handleExportXlsx,
    handleExportXmlZip,
    xmlZipCount,
    PDF_ROW_LIMIT,
    XLSX_ROW_LIMIT,
    CSV_ROW_LIMIT,
    confirmDialogs: (
      <>
        {dialogCsv}
        {dialogPdf}
        {dialogXlsx}
        {dialogZip}
      </>
    ),
  };
}