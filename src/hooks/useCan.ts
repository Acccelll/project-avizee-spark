/**
 * Hook `useCan` — única fonte de verdade para verificação de permissões
 * no frontend.
 *
 * Expõe a função `can(permission)` memoizada que consulta as permissões do
 * usuário autenticado (via AuthContext) e suporta wildcards e pseudo-permissão
 * `admin`.
 *
 * @example
 * const { can } = useCan();
 * if (can('usuarios:criar')) { ... }
 * if (can('usuarios:*'))     { ... }  // todas as ações do recurso
 */

import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { buildPermissionSet } from "@/lib/permissions";
import { checkPermission, type Permission } from "@/utils/permissions";

export interface UseCan {
  /** Verifica se o usuário possui a permissão informada. */
  can: (permission: Permission) => boolean;
  /** `true` enquanto as permissões ainda estão sendo carregadas. */
  loading: boolean;
}

export function useCan(): UseCan {
  const { roles, extraPermissions, loading, permissionsLoaded } = useAuth();

  // Reconstrói o conjunto somente quando roles/extraPermissions mudam
  const permissionSet = useMemo(
    () => buildPermissionSet(roles, extraPermissions),
    [roles, extraPermissions]
  );

  const can = useCallback(
    (permission: Permission): boolean => {
      // Aguarda carregamento para não negar acesso prematuramente
      if (!permissionsLoaded) return false;
      return checkPermission(permissionSet, permission);
    },
    [permissionSet, permissionsLoaded]
  );

  return { can, loading: loading || !permissionsLoaded };
}
