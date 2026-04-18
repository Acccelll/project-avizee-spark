/**
 * `useAuthGate` — fonte única de verdade para o estado dos route guards.
 *
 * Consolida a lógica de "espera de sessão + permissões" que era duplicada
 * em `ProtectedRoute`, `AdminRoute` e `SocialRoute`. Retorna um discriminador
 * `status` que cobre os 3 estados relevantes para um guard:
 *  - `loading` — ainda aguardando sessão ou roles/permissions
 *  - `unauthenticated` — sem sessão ativa
 *  - `authenticated` — sessão e permissões prontas para uso
 */

import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

export type AuthGateStatus = "loading" | "unauthenticated" | "authenticated";

export interface UseAuthGate {
  status: AuthGateStatus;
  user: User | null;
}

export function useAuthGate(): UseAuthGate {
  const { user, loading, permissionsLoaded } = useAuth();

  if (loading || (user && !permissionsLoaded)) {
    return { status: "loading", user };
  }

  if (!user) {
    return { status: "unauthenticated", user: null };
  }

  return { status: "authenticated", user };
}
