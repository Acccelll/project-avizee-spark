import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useCan } from '@/hooks/useCan';
import { quickActions, type QuickAction } from '@/lib/navigation';
import type { Permission } from '@/utils/permissions';

const PREFERENCE_KEY = 'mobile_quick_actions';
const MAX_ITEMS = 6;

/**
 * Atalhos rápidos do MobileMenu, personalizados pelo usuário.
 * - Persiste array de IDs em `user_preferences.mobile_quick_actions`.
 * - Filtra por permissão (`useCan`).
 * - Quando preferência ausente: usa todos os atalhos permitidos (até 6).
 */
export function useMobileQuickActions() {
  const { user } = useAuth();
  const { can } = useCan();
  const { value, save, loading } = useUserPreference<string[] | null>(
    user?.id ?? null,
    PREFERENCE_KEY,
    null,
  );

  const allowed = useMemo<QuickAction[]>(
    () => quickActions.filter((a) => !a.requires || can(a.requires as Permission)),
    [can],
  );

  const visible = useMemo<QuickAction[]>(() => {
    if (!Array.isArray(value)) {
      return allowed.slice(0, MAX_ITEMS);
    }
    const byId = new Map(allowed.map((a) => [a.id, a]));
    return value
      .map((id) => byId.get(id))
      .filter((a): a is QuickAction => Boolean(a))
      .slice(0, MAX_ITEMS);
  }, [allowed, value]);

  const saveSelection = useCallback(
    (ids: string[]) => {
      void save(ids.slice(0, MAX_ITEMS));
    },
    [save],
  );

  return { visible, allowed, saveSelection, loading, max: MAX_ITEMS };
}