import { useCallback } from 'react';
import { toast } from 'sonner';
import { exportarParaCsv, exportarParaExcel, exportarParaPdf, type ExportColumnDef } from '@/services/export.service';

/**
 * Hook que encapsula a exportação CSV/XLSX/PDF do DataTable, incluindo
 * progresso por chunk + ETA. Extraído do `DataTable.tsx` para reduzir o
 * God component (Fase 11 do roadmap de Design System).
 */
export interface UseDataTableExportOptions<T> {
  rows: T[];
  columns: { key: string; label: string }[];
  titulo: string;
  /** Tamanho do chunk (linhas) — afeta granularidade do progresso. */
  chunkSize?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useDataTableExport<T extends Record<string, unknown>>({
  rows,
  columns,
  titulo,
  chunkSize = 1000,
}: UseDataTableExportOptions<T>) {
  const exportData = useCallback(
    async (format: 'csv' | 'xlsx' | 'pdf') => {
      if (rows.length === 0) {
        toast.warning('Nenhum dado para exportar.');
        return;
      }
      const toastId = toast.loading(`Iniciando exportação ${format.toUpperCase()}... 0%`);
      try {
        const built: Record<string, unknown>[] = [];
        const startedAt = Date.now();
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows
            .slice(i, i + chunkSize)
            .map((row) => Object.fromEntries(columns.map((col) => [col.key, row[col.key]])));
          built.push(...chunk);
          const processed = Math.min(i + chunk.length, rows.length);
          const progress = Math.round((processed / rows.length) * 100);
          const elapsed = Date.now() - startedAt;
          const showEta = rows.length > 10000 && processed > 0;
          const etaMs = showEta ? Math.max(0, Math.round((elapsed / processed) * (rows.length - processed))) : 0;
          const etaText = showEta ? ` · ETA ~${Math.ceil(etaMs / 1000)}s` : '';
          toast.loading(`Exportando ${format.toUpperCase()}... ${progress}%${etaText}`, { id: toastId });
          await sleep(0);
        }
        const columnsDef: ExportColumnDef[] = columns.map((c) => ({ key: c.key, label: c.label }));
        if (format === 'csv') {
          exportarParaCsv({ titulo, rows: built, columns: columnsDef });
          toast.success('Exportação CSV concluída', { id: toastId });
          return;
        }
        if (format === 'xlsx') {
          await exportarParaExcel({ titulo, rows: built, columns: columnsDef });
          toast.success('Exportação XLSX concluída', { id: toastId });
          return;
        }
        await exportarParaPdf({ titulo, rows: built, columns: columnsDef });
        toast.success('Exportação PDF concluída', { id: toastId });
      } catch (error) {
        console.error('Erro ao exportar dados', error);
        toast.error(`Falha ao exportar ${format.toUpperCase()}.`, {
          id: toastId,
          action: { label: 'Tentar novamente', onClick: () => { void exportData(format); } },
        });
      }
    },
    [rows, columns, titulo, chunkSize],
  );

  return { exportData };
}
