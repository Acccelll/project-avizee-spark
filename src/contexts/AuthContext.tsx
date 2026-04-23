import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  APP_ROLES,
  type AppRole,
  type PermissionKey,
} from "@/lib/permissions";

/** Re-export para preservar imports existentes (`import type { AppRole } from "@/contexts/AuthContext"`). */
export type { AppRole };

/** Values that may exist in legacy rows but are no longer issued. */
const LEGACY_ROLES = new Set(["moderator", "user"]);
const VALID_APP_ROLES: ReadonlySet<string> = new Set(APP_ROLES);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once the initial roles + permissions fetches for the current user have settled (success or error). */
  permissionsLoaded: boolean;
  profile: { nome: string; email: string; cargo: string; avatar_url: string } | null;
  roles: AppRole[];
  /** Permissões individuais concedidas (allowed=true). */
  extraPermissions: PermissionKey[];
  /** Permissões individuais explicitamente revogadas (allowed=false) — vencem permissões herdadas do papel. */
  deniedPermissions: PermissionKey[];
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  /** Re-busca o profile do usuário atual (útil após edição em Configurações). */
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

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [profile, setProfile] = useState<{ nome: string; email: string; cargo: string; avatar_url: string } | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [extraPermissions, setExtraPermissions] = useState<PermissionKey[]>([]);
  const [deniedPermissions, setDeniedPermissions] = useState<PermissionKey[]>([]);
  const manualSignOut = useRef(false);
  const permissionsFetchId = useRef(0);
  const userRef = useRef<User | null>(null);
  const permissionsLoadedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    permissionsLoadedRef.current = permissionsLoaded;
  }, [permissionsLoaded]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) setProfile(data);
    } catch (err) {
      console.error("[auth] Failed to fetch profile", err);
    }
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (data) {
        const validRoles = (data as unknown as Array<{ role: string }>)
          .map((r) => r.role)
          .filter((r): r is AppRole => !LEGACY_ROLES.has(r) && VALID_APP_ROLES.has(r));
        setRoles(validRoles);
      }
    } catch (err) {
      console.error("[auth] Failed to fetch roles", err);
      setRoles([]);
    }
  };

  const fetchExtraPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("resource, action, allowed")
        .eq("user_id", userId);
      if (error) throw error;
      const allow: PermissionKey[] = [];
      const deny: PermissionKey[] = [];
      for (const row of (data || []) as Array<{ resource: string; action: string; allowed: boolean }>) {
        const key = `${row.resource}:${row.action}` as PermissionKey;
        if (row.allowed) allow.push(key);
        else deny.push(key);
      }
      setExtraPermissions(allow);
      setDeniedPermissions(deny);
    } catch (err) {
      console.error("[auth] Failed to fetch extra permissions", err);
      setExtraPermissions([]);
      setDeniedPermissions([]);
    }
  };

  const fetchPermissions = async (userId: string, options?: { background?: boolean }) => {
    const fetchId = ++permissionsFetchId.current;
    const background = options?.background ?? false;

    if (!background) {
      setPermissionsLoaded(false);
    }

    try {
      await Promise.all([fetchRoles(userId), fetchExtraPermissions(userId)]);
    } finally {
      if (fetchId === permissionsFetchId.current) {
        setPermissionsLoaded(true);
      }
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const safetyTimeout = setTimeout(() => {
      if (!isMounted) return;
      setLoading((currentLoading) => {
        if (currentLoading) {
          console.warn("[auth] Auth initialization timed out. Forcing loading false.");
          return false;
        }
        return currentLoading;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const currentUser = userRef.current;
      const sameUser = currentSession?.user?.id === currentUser?.id;

      if (event === 'SIGNED_OUT' && !manualSignOut.current && currentUser) {
        toast.error("Sua sessão expirou. Faça login novamente.");
      }
      manualSignOut.current = false;

      if (currentSession?.user) {
        setSession(currentSession);

        if (!sameUser) {
          setUser(currentSession.user);
        }

        if (event === 'TOKEN_REFRESHED' && sameUser) {
          clearTimeout(safetyTimeout);
          setLoading(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              fetchPermissions(currentSession.user.id),
            ]);
          } finally {
            clearTimeout(safetyTimeout);
            setLoading(false);
          }
          return;
        }

        clearTimeout(safetyTimeout);
        setLoading(false);
        fetchProfile(currentSession.user.id);
        fetchPermissions(currentSession.user.id, {
          background: sameUser && permissionsLoadedRef.current,
        });
        return;
      }

      setSession(currentSession);
      setUser(null);
      setProfile(null);
      setRoles([]);
      setExtraPermissions([]);
      setDeniedPermissions([]);
      setPermissionsLoaded(false);
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    await fetchProfile(currentUser.id);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    manualSignOut.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setExtraPermissions([]);
    setDeniedPermissions([]);
    setPermissionsLoaded(false);
    // Centraliza o redirect — qualquer caller (header, mobile menu, expiração)
    // garante o mesmo destino e evita estados intermediários onde a UI antiga
    // continua montada após o logout.
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, []);

  const contextValue = useMemo(
    () => ({ user, session, loading, permissionsLoaded, profile, roles, extraPermissions, deniedPermissions, hasRole, signOut, refreshProfile }),
    [user, session, loading, permissionsLoaded, profile, roles, extraPermissions, deniedPermissions, hasRole, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
