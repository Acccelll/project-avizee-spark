import { useCallback } from 'react';
import { toast } from 'sonner';
import { exportarParaCsv, exportarParaExcel, exportarParaPdf, type ExportColumnDef } from '@/services/export.service';
import { useCan } from '@/hooks/useCan';
import type { PermissionKey } from '@/lib/permissions';
import { logger } from "@/lib/logger";
import { getExportRowsLoader } from "@/lib/exportRowsRegistry";

/**
 * Hook que encapsula a exportação CSV/XLSX/PDF do DataTable, incluindo
 * progresso por chunk + ETA. Extraído do `DataTable.tsx` para reduzir o
 * God component (Fase 11 do roadmap de Design System).
 */
export interface UseDataTableExportOptions<T> {
  /** Linhas já carregadas. Usadas diretamente quando `loadRows` não existe. */
  rows: T[];
  /**
   * Fonte assíncrona opcional do conjunto completo a exportar.
   * Em listas com paginação server-side deve reaplicar os filtros/ordenação
   * atuais e buscar todas as páginas, sem alterar a página visível na UI.
   */
  loadRows?: () => Promise<T[]>;
  columns: { key: string; label: string }[];
  titulo: string;
  /** Tamanho do chunk (linhas) — afeta granularidade do progresso. */
  chunkSize?: number;
  /**
   * Permissão necessária para exportar. Quando informada, o hook bloqueia a
   * exportação para usuários sem o privilégio (ver mem://auth/papeis-de-usuario).
   * Default sugerido nas chamadas: "relatorios:exportar".
   */
  permission?: PermissionKey;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useDataTableExport<T extends Record<string, unknown>>({
  rows,
  loadRows,
  columns,
  titulo,
  chunkSize = 1000,
  permission,
}: UseDataTableExportOptions<T>) {
  const { can } = useCan();
  const exportData = useCallback(
    async (format: 'csv' | 'xlsx' | 'pdf') => {
      if (permission && !can(permission)) {
        toast.error('Sem permissão para exportar', {
          description: 'Solicite acesso a um administrador para exportar dados deste módulo.',
        });
        return;
      }

      // A prop explícita tem prioridade. O registry é fallback para módulos
      // server-paged já padronizados no useSupabaseCrud, evitando que telas
      // legadas continuem exportando apenas a página corrente.
      const resolvedLoader = loadRows ?? getExportRowsLoader<T>(titulo);
      const toastId = toast.loading(
        resolvedLoader
          ? `Preparando dados completos para ${format.toUpperCase()}...`
          : `Iniciando exportação ${format.toUpperCase()}... 0%`,
      );

      try {
        const sourceRows = resolvedLoader ? await resolvedLoader() : rows;
        if (sourceRows.length === 0) {
          toast.warning('Nenhum dado para exportar.', { id: toastId });
          return;
        }

        const built: Record<string, unknown>[] = [];
        const startedAt = Date.now();
        for (let i = 0; i < sourceRows.length; i += chunkSize) {
          const chunk = sourceRows
            .slice(i, i + chunkSize)
            .map((row) => Object.fromEntries(columns.map((col) => [col.key, row[col.key]])));
          built.push(...chunk);
          const processed = Math.min(i + chunk.length, sourceRows.length);
          const progress = Math.round((processed / sourceRows.length) * 100);
          const elapsed = Date.now() - startedAt;
          const showEta = sourceRows.length > 10000 && processed > 0;
          const etaMs = showEta ? Math.max(0, Math.round((elapsed / processed) * (sourceRows.length - processed))) : 0;
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
        logger.error('Erro ao exportar dados', error);
        const description = error instanceof Error ? error.message : undefined;
        toast.error(`Falha ao exportar ${format.toUpperCase()}.`, {
          id: toastId,
          description,
          action: { label: 'Tentar novamente', onClick: () => { void exportData(format); } },
        });
      }
    },
    [rows, loadRows, columns, titulo, chunkSize, permission, can],
  );

  return { exportData };
}
