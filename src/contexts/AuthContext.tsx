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
        const validAppRoles: string[] = ["admin", "vendedor", "financeiro", "estoquista"];
        const validRoles = (data as unknown as Array<{ role: string }>)
          .map((r) => r.role)
          .filter((r): r is AppRole => !LEGACY_ROLES.has(r) && validAppRoles.includes(r));
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
        .eq("user_id", userId)
        .eq("allowed", true);
      if (error) throw error;
      const keys = ((data || []) as Array<{ resource: string; action: string }>).map(
        (item) => `${item.resource}:${item.action}` as PermissionKey
      );
      setExtraPermissions(keys);
    } catch (err) {
      console.error("[auth] Failed to fetch extra permissions", err);
      setExtraPermissions([]);
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

    const safetyTimeout = setTimeout(() => {
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
      setPermissionsLoaded(false);
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

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
