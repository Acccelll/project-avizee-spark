import { useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';

const LEGACY_STORAGE_KEY = 'erp:favorites';
const PREFERENCE_KEY = 'sidebar_favorites';

/**
 * Persists an ordered list of favorite nav-item paths in
 * `user_preferences` (synced across devices via Supabase). Falls back to
 * a guest-local cache when the user is unauthenticated. Migrates the
 * legacy `localStorage` key once per session.
 */
export function useFavoritos() {
  const { user } = useAuth();
  const { value, save } = useUserPreference<string[]>(user?.id ?? null, PREFERENCE_KEY, []);
  const favoritos = Array.isArray(value) ? value : [];

  // One-shot migration from the legacy localStorage key for users who had
  // favorites before backend sync existed.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && favoritos.length === 0) {
        void save(parsed as string[]);
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggleFavorito = useCallback(
    (path: string) => {
      const next = favoritos.includes(path)
        ? favoritos.filter((p) => p !== path)
        : [...favoritos, path];
      void save(next);
    },
    [favoritos, save],
  );

  const isFavorito = useCallback((path: string) => favoritos.includes(path), [favoritos]);

  return { favoritos, toggleFavorito, isFavorito };
}
