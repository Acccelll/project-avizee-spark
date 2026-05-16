import { useCallback, useState } from 'react';

export type RelatorioLayout = 'stacked' | 'side-by-side';

const STORAGE_KEY = 'relatorio-layout';

export function useRelatorioLayout() {
  const [layout, setLayoutState] = useState<RelatorioLayout>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as RelatorioLayout | null;
      return v === 'side-by-side' ? 'side-by-side' : 'stacked';
    } catch {
      return 'stacked';
    }
  });

  const toggleLayout = useCallback(() => {
    setLayoutState((prev) => {
      const next: RelatorioLayout = prev === 'stacked' ? 'side-by-side' : 'stacked';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { layout, toggleLayout };
}