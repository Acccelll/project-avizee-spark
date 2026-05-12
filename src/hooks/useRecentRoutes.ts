import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { flatNavItems, type FlatNavItem } from '@/lib/navigation';

const STORAGE_KEY = 'erp:recent-routes';
const MAX_ITEMS = 5;
/** Rotas que não fazem sentido aparecer em "Recentes" (efêmeras / sub-rotas). */
const IGNORED_PREFIXES = ['/auth', '/configuracoes', '/perfil', '/ajuda'];
const IGNORED_PATHS = new Set(['/']);

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecents(items: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage indisponível — silencioso
  }
}

/** Map path (sem query) → FlatNavItem para resolução visual. */
const flatByPath = new Map<string, FlatNavItem>(
  flatNavItems.map((item) => [item.path.split('?')[0], item]),
);

/**
 * Mantém em localStorage as últimas rotas visitadas (até 5), ignorando rotas
 * efêmeras. Cada visita move a rota para o topo (LRU).
 * Use `useTrackRecentRoutes()` em algum ponto montado uma única vez (AppLayout).
 */
export function useRecentRoutes(): {
  recents: FlatNavItem[];
  clearRecents: () => void;
} {
  const [paths, setPaths] = useState<string[]>(() => loadRecents());

  // Sync entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPaths(loadRecents());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Re-load on mount (covers updates triggered by useTrackRecentRoutes)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const fresh = loadRecents();
      setPaths((prev) => (prev.join('|') === fresh.join('|') ? prev : fresh));
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  const recents = useMemo<FlatNavItem[]>(
    () =>
      paths
        .map((p) => flatByPath.get(p))
        .filter((item): item is FlatNavItem => Boolean(item)),
    [paths],
  );

  const clearRecents = useCallback(() => {
    saveRecents([]);
    setPaths([]);
  }, []);

  return { recents, clearRecents };
}

/**
 * Registra cada navegação no LRU de recentes. Montar UMA vez no AppLayout.
 */
export function useTrackRecentRoutes() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (IGNORED_PATHS.has(path)) return;
    if (IGNORED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return;
    if (!flatByPath.has(path)) return; // só rotas conhecidas no nav
    const current = loadRecents();
    const next = [path, ...current.filter((p) => p !== path)].slice(0, MAX_ITEMS);
    if (current.join('|') === next.join('|')) return;
    saveRecents(next);
  }, [location.pathname]);
}