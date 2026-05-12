import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { NAV_PROFILES, type NavProfile } from '@/lib/navigation/profiles';

const PREFERENCE_KEY = 'nav_profile';
const DEFAULT_PROFILE: NavProfile = 'completo';

function isNavProfile(value: unknown): value is NavProfile {
  return typeof value === 'string' && (NAV_PROFILES as readonly string[]).includes(value);
}

/**
 * Perfil operacional do usuário (modo de visão do menu mobile).
 * Persistido em `user_preferences`; fallback local quando guest.
 */
export function useNavProfile() {
  const { user } = useAuth();
  const { value, save, loading } = useUserPreference<NavProfile | null>(
    user?.id ?? null,
    PREFERENCE_KEY,
    DEFAULT_PROFILE,
  );

  const profile: NavProfile = isNavProfile(value) ? value : DEFAULT_PROFILE;

  const setProfile = useCallback(
    (next: NavProfile) => {
      void save(next);
    },
    [save],
  );

  return { profile, setProfile, loading };
}