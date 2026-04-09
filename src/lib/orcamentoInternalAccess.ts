import type { AppRole } from "@/contexts/AuthContext";

export interface OrcamentoInternalAccess {
  canViewInternalMargin: boolean;
  canViewInternalCosts: boolean;
  canEditInternalCostBasis: boolean;
}

export function getOrcamentoInternalAccess(roles: AppRole[]): OrcamentoInternalAccess {
  const hasRole = (role: AppRole) => roles.includes(role);

  // TODO: integrar com user_permissions específico de rentabilidade.
  const canView = hasRole("admin") || hasRole("financeiro");

  return {
    canViewInternalMargin: canView,
    canViewInternalCosts: canView,
    canEditInternalCostBasis: hasRole("admin"),
  };
}
