import { useCallback, useState } from 'react';

const STORAGE_KEY = 'erp:favorites';

/**
 * Persists an ordered list of favorite nav-item paths in localStorage.
 * Returns stable callbacks so callers don't need `useCallback` wrappers.
 */
export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorito = useCallback((path: string) => {
    setFavoritos((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // quota exceeded – silently ignore
      }
      return next;
    });
  }, []);

  const isFavorito = useCallback(
    (path: string) => favoritos.includes(path),
    [favoritos],
  );

  return { favoritos, toggleFavorito, isFavorito };
}
