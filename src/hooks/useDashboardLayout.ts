import { useCallback, useMemo, useState } from 'react';

export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type WidgetId =
  | 'kpis'
  | 'alertas'
  | 'financeiro'
  | 'acoes_rapidas'
  | 'comercial'
  | 'estoque'
  | 'logistica'
  | 'fiscal'
  | 'vendas_chart'
  | 'pendencias';

export const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { i: 'kpis',          x: 0, y: 0,  w: 12, h: 3, minW: 6,  minH: 2 },
  { i: 'alertas',       x: 0, y: 3,  w: 12, h: 2, minW: 6,  minH: 1 },
  { i: 'financeiro',    x: 0, y: 5,  w: 8,  h: 7, minW: 4,  minH: 4 },
  { i: 'acoes_rapidas', x: 8, y: 5,  w: 4,  h: 7, minW: 3,  minH: 3 },
  { i: 'vendas_chart',  x: 0, y: 12, w: 6,  h: 5, minW: 4,  minH: 3 },
  { i: 'pendencias',    x: 6, y: 12, w: 6,  h: 5, minW: 4,  minH: 2 },
  { i: 'comercial',     x: 0, y: 17, w: 6,  h: 6, minW: 4,  minH: 3 },
  { i: 'estoque',       x: 6, y: 17, w: 6,  h: 6, minW: 4,  minH: 3 },
  { i: 'logistica',     x: 0, y: 23, w: 6,  h: 6, minW: 4,  minH: 2 },
  { i: 'fiscal',        x: 6, y: 23, w: 6,  h: 5, minW: 4,  minH: 2 },
];

// ── Increment this string whenever DEFAULT_LAYOUT changes ─────────────────────
// A new key means users with an old cached layout will get the new defaults.
const STORAGE_KEY_PREFIX = 'avizee:dashboard-layout:v2:';

function buildKey(userId: string | null | undefined) {
  return `${STORAGE_KEY_PREFIX}${userId ?? 'anon'}`;
}

function readFromStorage(key: string): DashboardLayoutItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as DashboardLayoutItem[];
  } catch {
    // ignore malformed data
  }
  return null;
}

export function useDashboardLayout(userId: string | null | undefined) {
  const storageKey = useMemo(() => buildKey(userId), [userId]);

  const [layout, setLayoutState] = useState<DashboardLayoutItem[]>(() => {
    return readFromStorage(buildKey(userId)) ?? DEFAULT_LAYOUT;
  });

  const setLayout = useCallback(
    (nextLayout: DashboardLayoutItem[]) => {
      setLayoutState(nextLayout);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextLayout));
      } catch {
        // quota exceeded or storage unavailable
      }
    },
    [storageKey],
  );

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { layout, setLayout, resetLayout };
}
