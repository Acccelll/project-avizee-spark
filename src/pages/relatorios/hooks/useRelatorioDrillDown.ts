import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportConfigs, type ReportDrillDownAction } from '@/config/relatoriosConfig';
import type { TipoRelatorio } from '@/services/relatorios.service';

export interface ResolvedDrillAction extends ReportDrillDownAction {
  /** Caminho final pronto para navegação. */
  href: string;
}

/**
 * Resolve as ações de drill-down disponíveis para um relatório, com base no
 * `drillDown` declarado em `reportConfigs` e nos IDs anexados a cada row pelos
 * loaders (ex.: `produtoId`, `lancamentoId`, `clienteId`).
 *
 * Apenas ações marcadas como `available` e cujo `targetField` exista de fato
 * na row são retornadas — assim o front nunca tenta navegar para uma rota
 * sem o ID necessário.
 */
export function useRelatorioDrillDown(tipo: TipoRelatorio | undefined) {
  const navigate = useNavigate();
  const cfg = tipo ? reportConfigs[tipo] : undefined;
  const actions = useMemo(() => cfg?.drillDown ?? [], [cfg]);

  const getRowActions = useCallback(
    (row: Record<string, unknown>): ResolvedDrillAction[] => {
      if (!actions.length) return [];
      return actions
        .filter((a) => a.available && a.route && a.targetField)
        .map((a) => {
          const id = row[a.targetField as string];
          if (id == null || id === '') return null;
          // Roteamento simples: rota base + ?focus=<id>. Telas-destino que ainda
          // não consomem `focus` apenas ignoram o parâmetro — comportamento
          // seguro e progressivo.
          const route = a.route as string;
          const sep = route.includes('?') ? '&' : '?';
          const href = `${route}${sep}focus=${encodeURIComponent(String(id))}`;
          return { ...a, href } as ResolvedDrillAction;
        })
        .filter((x): x is ResolvedDrillAction => x !== null);
    },
    [actions],
  );

  const navigateAction = useCallback(
    (action: ResolvedDrillAction) => {
      navigate(action.href);
    },
    [navigate],
  );

  return { actions, getRowActions, navigateAction, hasActions: actions.length > 0 };
}