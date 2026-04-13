import type { AppRole } from "@/contexts/AuthContext";
import type { PermissionKey } from "@/lib/permissions";

export interface OrcamentoInternalAccess {
  canViewInternalMargin: boolean;
  canViewInternalCosts: boolean;
  canEditInternalCostBasis: boolean;
}

/**
 * Determines the current user's access to internal financial data on quotations
 * (cost basis, margin, profitability).
 *
 * - Admin role: full access without checking granular permissions.
 * - Other roles: checks `orcamentos:visualizar_rentabilidade` in the user's
 *   extra permissions (loaded by AuthContext at login, no DB query needed).
 * - Editing cost basis is always restricted to admin.
 */
export function getOrcamentoInternalAccess(
  roles: AppRole[],
  extraPermissions: PermissionKey[] = [],
): OrcamentoInternalAccess {
  const hasRole = (role: AppRole) => roles.includes(role);

  // Admin always has full access
  if (hasRole("admin")) {
    return {
      canViewInternalMargin: true,
      canViewInternalCosts: true,
      canEditInternalCostBasis: true,
    };
  }

  // For non-admin roles, check the specific rentabilidade permission from user_permissions
  const hasRentabilidade = extraPermissions.includes("orcamentos:visualizar_rentabilidade" as PermissionKey);

  // Financeiro inherently sees costs; others need the explicit permission
  const canView = hasRole("financeiro") || hasRentabilidade;

  return {
    canViewInternalMargin: canView,
    canViewInternalCosts: canView,
    canEditInternalCostBasis: false, // only admin
  };
}
