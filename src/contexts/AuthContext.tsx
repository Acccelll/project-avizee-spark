import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode, useMemo } from "react";
import { User, Session, type AuthChangeEvent } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  APP_ROLES,
  type AppRole,
  type PermissionKey,
} from "@/lib/permissions";
import { logger } from "@/lib/logger";
import {
  fetchAuthProfile,
  fetchAuthRoles,
  fetchAuthPermissions,
  type AuthProfileRow,
} from "@/services/auth.service";

export type { AppRole };

const LEGACY_ROLES = new Set(["moderator", "user"]);
const VALID_APP_ROLES: ReadonlySet<string> = new Set(APP_ROLES);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

interface ResolvedPermissions {
  roles: AppRole[];
  allowed: PermissionKey[];
  denied: PermissionKey[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  permissionsLoaded: boolean;
  profile: {
    nome: string | null;
    email: string | null;
    cargo: string | null;
    avatar_url: string | null;
  } | null;
  roles: AppRole[];
  extraPermissions: PermissionKey[];
  deniedPermissions: PermissionKey[];
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  permissionsLoaded: false,
  profile: null,
  roles: [],
  extraPermissions: [],
  deniedPermissions: [],
  hasRole: () => false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}_timeout`)), AUTH_BOOTSTRAP_TIMEOUT_MS);
    }),
  ]);
}

async function resolveProfile(userId: string): Promise<AuthProfileRow | null> {
  try {
    return await fetchAuthProfile(userId);
  } catch (err) {
    logger.error("[auth] Failed to fetch profile", err);
    return null;
  }
}

async function resolvePermissions(userId: string): Promise<ResolvedPermissions> {
  const [rolesResult, permissionsResult] = await Promise.allSettled([
    fetchAuthRoles(userId),
    fetchAuthPermissions(userId),
  ]);

  let roles: AppRole[] = [];
  let allowed: PermissionKey[] = [];
  let denied: PermissionKey[] = [];

  if (rolesResult.status === "fulfilled") {
    roles = rolesResult.value.filter(
      (role): role is AppRole => !LEGACY_ROLES.has(role) && VALID_APP_ROLES.has(role),
    );
  } else {
    logger.error("[auth] Failed to fetch roles", rolesResult.reason);
  }

  if (permissionsResult.status === "fulfilled") {
    allowed = permissionsResult.value.allowed;
    denied = permissionsResult.value.denied;
  } else {
    logger.error("[auth] Failed to fetch extra permissions", permissionsResult.reason);
  }

  return { roles, allowed, denied };
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [profile, setProfile] = useState<{
    nome: string | null;
    email: string | null;
    cargo: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [extraPermissions, setExtraPermissions] = useState<PermissionKey[]>([]);
  const [deniedPermissions, setDeniedPermissions] = useState<PermissionKey[]>([]);
  const manualSignOut = useRef(false);
  const bootstrapRequestId = useRef(0);
  const userRef = useRef<User | null>(null);
  const permissionsLoadedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    permissionsLoadedRef.current = permissionsLoaded;
  }, [permissionsLoaded]);

  const resetAuthState = useCallback(() => {
    bootstrapRequestId.current += 1;
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setExtraPermissions([]);
    setDeniedPermissions([]);
    setPermissionsLoaded(false);
  }, []);

  const hydrateUserState = useCallback(async (userId: string, options?: { background?: boolean }) => {
    const requestId = ++bootstrapRequestId.current;
    const background = options?.background ?? false;

    if (!background) {
      setLoading(true);
      setPermissionsLoaded(false);
    }

    try {
      const [resolvedProfile, resolvedPermissions] = await withTimeout(
        Promise.all([
          resolveProfile(userId),
          resolvePermissions(userId),
        ]),
        "auth_bootstrap",
      );

      if (!mountedRef.current || requestId !== bootstrapRequestId.current) return;

      setProfile(resolvedProfile);
      setRoles(resolvedPermissions.roles);
      setExtraPermissions(resolvedPermissions.allowed);
      setDeniedPermissions(resolvedPermissions.denied);
    } catch (err) {
      logger.error("[auth] Failed to hydrate auth state", err);
      if (!mountedRef.current || requestId !== bootstrapRequestId.current) return;
      setProfile(null);
      setRoles([]);
      setExtraPermissions([]);
      setDeniedPermissions([]);
    } finally {
      if (!mountedRef.current || requestId !== bootstrapRequestId.current) return;
      setPermissionsLoaded(true);
      setLoading(false);
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const handleAuthEvent = (event: AuthChangeEvent, currentSession: Session | null) => {
      const currentUser = userRef.current;
      const sameUser = currentSession?.user?.id === currentUser?.id;

      if (event === "SIGNED_OUT" && !manualSignOut.current && currentUser) {
        toast.error("Sua sessão expirou. Faça login novamente.");
      }
      manualSignOut.current = false;

      if (!currentSession?.user) {
        resetAuthState();
        setLoading(false);
        return;
      }

      applySession(currentSession);

      if (event === "TOKEN_REFRESHED" && sameUser && permissionsLoadedRef.current) {
        setLoading(false);
        return;
      }

      const shouldBlock = !sameUser || !permissionsLoadedRef.current;
      void hydrateUserState(currentSession.user.id, { background: !shouldBlock });
    };

    const bootstrap = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), "get_session");
        if (!mountedRef.current) return;
        if (error) throw error;

        if (!data.session?.user) {
          resetAuthState();
          setLoading(false);
          return;
        }

        applySession(data.session);
        await hydrateUserState(data.session.user.id);
      } catch (err) {
        logger.error("[auth] Failed to restore session", err);
        if (!mountedRef.current) return;
        resetAuthState();
        setLoading(false);
      }
    };

    void bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => {
        if (!mountedRef.current) return;
        handleAuthEvent(event, currentSession);
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession, hydrateUserState, resetAuthState]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const refreshed = await resolveProfile(currentUser.id);
    if (!mountedRef.current || currentUser.id !== userRef.current?.id) return;
    setProfile(refreshed);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    manualSignOut.current = true;
    await supabase.auth.signOut();
    resetAuthState();
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, [resetAuthState]);

  const contextValue = useMemo(
    () => ({ user, session, loading, permissionsLoaded, profile, roles, extraPermissions, deniedPermissions, hasRole, signOut, refreshProfile }),
    [user, session, loading, permissionsLoaded, profile, roles, extraPermissions, deniedPermissions, hasRole, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
