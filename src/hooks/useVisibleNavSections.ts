import { useMemo } from 'react';
import { navSections, type NavSection, type NavSectionKey } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCan } from '@/hooks/useCan';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getSocialPermissionFlags } from '@/types/social';
import type { ErpResource } from '@/lib/permissions';

/**
 * Maps each navSection to the ErpResources that grant access to it.
 * A section is visible when the user can `visualizar` ANY of its resources.
 * Typed against ErpResource so adding/removing a resource is a compile-time check.
 */
const sectionResourcesMap: Partial<Record<NavSectionKey, ErpResource[]>> = {
  cadastros: ['produtos', 'clientes', 'fornecedores', 'transportadoras', 'formas_pagamento'],
  comercial: ['orcamentos', 'pedidos'],
  compras: ['compras'],
  estoque: ['estoque', 'logistica'],
  financeiro: ['financeiro'],
  fiscal: ['faturamento_fiscal'],
  relatorios: ['relatorios'],
  administracao: ['administracao'],
  // social handled separately via socialPermissions flag
};

/**
 * Returns the navSections that should be visible to the current user.
 * Single source of truth used by AppSidebar, MobileMenu and MobileBottomNav
 * so desktop and mobile stay in lockstep on permissions.
 */
export function useVisibleNavSections(): NavSection[] {
  const { isAdmin } = useIsAdmin();
  const { roles, extraPermissions, permissionsLoaded } = useAuth();
  const { can } = useCan();
  const socialPermissions = useMemo(
    () => getSocialPermissionFlags(roles, extraPermissions),
    [roles, extraPermissions]
  );

  return useMemo(() => {
    const withoutAdmin = isAdmin ? navSections : navSections.filter((s) => s.key !== 'administracao');
    const hasRecognizedRoles = roles.length > 0;

    return withoutAdmin
      .filter((s) => socialPermissions.canViewModule || s.key !== 'social')
      .filter((s) => {
        // While permissions are still loading we keep the strict view.
        // Only fall through when we KNOW the user has zero recognised roles.
        if (permissionsLoaded && !hasRecognizedRoles) return true;
        const resources = sectionResourcesMap[s.key];
        if (!resources || resources.length === 0) return true;
        return resources.some((resource) => can(`${resource}:visualizar`));
      });
  }, [isAdmin, socialPermissions.canViewModule, can, roles, permissionsLoaded]);
}

/** Returns the set of visible section keys — useful for filtering bottom-nav tabs. */
export function useVisibleSectionKeys(): Set<string> {
  const sections = useVisibleNavSections();
  return useMemo(() => new Set(sections.map((s) => s.key)), [sections]);
}
