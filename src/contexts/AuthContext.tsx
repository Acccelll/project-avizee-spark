import { createContext, useContext, useEffect, useState, useRef, ReactNode, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildPermissionSet, type ErpAction, type ErpResource, type PermissionKey, toPermissionKey } from "@/lib/permissions";

/** Roles recognised by the application. Aligns with the `app_role` enum in the database. */
export type AppRole = "admin" | "vendedor" | "financeiro" | "estoquista";

/** Values that may exist in legacy rows but are no longer issued. */
const LEGACY_ROLES = new Set(["moderator", "user"]);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once the initial roles + permissions fetches for the current user have settled (success or error). */
  permissionsLoaded: boolean;
  profile: { nome: string; email: string; cargo: string; avatar_url: string } | null;
  roles: AppRole[];
  extraPermissions: PermissionKey[];
  hasRole: (role: AppRole) => boolean;
  can: (resource: ErpResource, action: ErpAction) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  permissionsLoaded: false,
  profile: null,
  roles: [],
  extraPermissions: [],
  hasRole: () => false,
  can: () => false,
  signOut: async () => {},
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
  const manualSignOut = useRef(false);
  const permissionsFetchId = useRef(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Safety net: if auth initialization takes > 5s, force loading = false to unblock the UI.
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("[auth] Auth initialization timed out. Forcing loading false.");
        setLoading(false);
      }
    }, 5000);

    // Sequencing logic:
    // - INITIAL_SESSION: We await fetchProfile + fetchPermissions BEFORE setting loading=false
    //   so the app never flashes in a state where user is set but permissions aren't loaded.
    // - SIGNED_IN / TOKEN_REFRESHED: These fire after the initial session, so permissions
    //   are already loaded. We refresh them in the background without blocking the UI.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT' && !manualSignOut.current && user) {
        toast.error("Sua sessão expirou. Faça login novamente.");
      }
      manualSignOut.current = false;

      if (currentSession?.user) {
        // On TOKEN_REFRESHED, skip state updates if the user hasn't changed
        // to avoid unnecessary re-renders (and potential form data loss).
        if (event === 'TOKEN_REFRESHED') {
          const userUnchanged = currentSession.user.id === user?.id;
          if (userUnchanged) {
            // Silently refresh the session reference without triggering re-renders
            setSession(currentSession);
            clearTimeout(safetyTimeout);
            setLoading(false);
            return;
          }
        }

        setSession(currentSession);
        setUser(currentSession.user);

        if (event === 'INITIAL_SESSION') {
          // First load: await profile & permissions before clearing loading state
          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              fetchPermissions(currentSession.user.id),
            ]);
          } finally {
            clearTimeout(safetyTimeout);
            setLoading(false);
          }
        } else {
          // Subsequent events (SIGNED_IN): refresh in background
          clearTimeout(safetyTimeout);
          setLoading(false);
          fetchProfile(currentSession.user.id);
          fetchPermissions(currentSession.user.id);
        }
      } else {
        setSession(currentSession);
        setUser(null);
        setProfile(null);
        setRoles([]);
        setExtraPermissions([]);
        setPermissionsLoaded(false);
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) setProfile(data);
    } catch {
      // Profile fetch failed silently
    }
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (data) {
        const validAppRoles: string[] = ["admin", "vendedor", "financeiro", "estoquista"];
        const validRoles = (data as unknown as Array<{ role: string }>)
          .map((r) => r.role)
          .filter((r): r is AppRole => !LEGACY_ROLES.has(r) && validAppRoles.includes(r));
        setRoles(validRoles);
      }
    } catch {
      setRoles([]);
    }
  };

  const fetchExtraPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("resource, action, allowed")
        .eq("user_id", userId)
        .eq("allowed", true);
      if (error) throw error;
      const keys = ((data || []) as Array<{ resource: string; action: string }>).map(
        (item) => `${item.resource}:${item.action}` as PermissionKey
      );
      setExtraPermissions(keys);
    } catch {
      setExtraPermissions([]);
    }
  };

  const fetchPermissions = async (userId: string) => {
    const fetchId = ++permissionsFetchId.current;
    setPermissionsLoaded(false);
    try {
      await Promise.all([fetchRoles(userId), fetchExtraPermissions(userId)]);
    } finally {
      if (fetchId === permissionsFetchId.current) {
        setPermissionsLoaded(true);
      }
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const mergedPermissions = useMemo(() => buildPermissionSet(roles, extraPermissions), [roles, extraPermissions]);

  const can = (resource: ErpResource, action: ErpAction) => {
    const key = toPermissionKey(resource, action);
    return mergedPermissions.has(key);
  };

  const signOut = async () => {
    if (!supabase) return;
    manualSignOut.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setExtraPermissions([]);
    setPermissionsLoaded(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, permissionsLoaded, profile, roles, extraPermissions, hasRole, can, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
