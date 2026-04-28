/**
 * Memoiza a lista de chips ativas exibidas em `<ActiveFiltersBar />`.
 *
 * Cada chip carrega: id estável, label/valor formatado, tom (relevant quando o
 * relatório destaca o filtro) e callback de remoção que escreve de volta no
 * estado de URL.
 *
 * Extraído de `Relatorios.tsx` (Fase 5 do roadmap).
 */

import { useMemo } from 'react';
import { formatDate } from '@/lib/format';
import type { ActiveFilterChip } from '@/pages/relatorios/components/ActiveFiltersBar';
import type {
  ReportConfig,
  ReportRuntimeSemantics,
} from '@/config/relatoriosConfig';
import type { FiltrosRelatorioState } from '@/pages/relatorios/components/Filtros/FiltrosRelatorio';

interface ClienteLite { id: string; nome_razao_social: string }
interface FornecedorLite { id: string; nome_razao_social: string }
interface GrupoLite { id: string; nome: string }

interface UseActiveFilterChipsArgs {
  filtrosState: FiltrosRelatorioState;
  dataInicio: string;
  dataFim: string;
  clientes: ClienteLite[];
  fornecedores: FornecedorLite[];
  grupos: GrupoLite[];
  selectedMeta?: ReportConfig;
  semantics?: ReportRuntimeSemantics;
  setFiltrosState: (partial: Partial<FiltrosRelatorioState>) => void;
  updateParams: (patch: Record<string, string | string[] | undefined>) => void;
}

export function useActiveFilterChips({
  filtrosState,
  dataInicio,
  dataFim,
  clientes,
  fornecedores,
  grupos,
  selectedMeta,
  semantics,
  setFiltrosState,
  updateParams,
}: UseActiveFilterChipsArgs): ActiveFilterChip[] {
  return useMemo<ActiveFilterChip[]>(() => {
    const out: ActiveFilterChip[] = [];
    if (dataInicio || dataFim) {
      out.push({
        id: 'periodo',
        label: 'Período',
        value: `${dataInicio ? formatDate(dataInicio) : '—'} → ${
          dataFim ? formatDate(dataFim) : '—'
        }`,
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
        tone: semantics?.highlightFilters?.includes('fornecedores')
          ? 'relevant'
          : 'default',
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
      const opt = (selectedMeta?.filters.statusOptions ?? []).find(
        (o) => o.value === filtrosState.statusFiltro,
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFiltrosState (callback de set) é estável; incluí-lo invalidaria o memo a cada render
  }, [
    filtrosState,
    clientes,
    fornecedores,
    grupos,
    selectedMeta,
    semantics,
    dataInicio,
    dataFim,
  ]);
}