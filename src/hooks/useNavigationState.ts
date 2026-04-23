import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isPathActive, type NavSection, type NavSectionKey } from '@/lib/navigation';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAuth } from '@/contexts/AuthContext';

export interface NavigationState {
  /** Full route incl. query, used for exact matching */
  currentRoute: string;
  /** Sections whose subtree contains (or directly maps to) the current route */
  activeSectionKeys: NavSectionKey[];
  /** Active matcher for a specific leaf path (handles `?query` items correctly) */
  isItemActive: (targetPath: string) => boolean;
  /** Whether a section's submenu should be expanded right now */
  isSectionOpen: (key: NavSectionKey, options?: { collapsed?: boolean }) => boolean;
  /** Toggle the manual override for a section */
  toggleSection: (key: NavSectionKey) => void;
  /** True when the user is navigating inside the Administração module shell */
  isInsideAdminModule: boolean;
}

/**
 * Centralises navigation-derived state used by AppSidebar (and reusable by mobile).
 * Handles:
 *  - Active section detection across direct + expandable sections.
 *  - Manual expand/collapse persistence per user.
 *  - Auto-clearing manual collapses when the user navigates INTO a hidden section,
 *    so the matching submenu re-opens (expected ERP behaviour).
 */
export function useNavigationState(visibleSections: NavSection[]): NavigationState {
  const location = useLocation();
  const { user } = useAuth();
  const currentRoute = `${location.pathname}${location.search}`;

  const isItemActive = useCallback(
    (targetPath: string) => {
      const [targetBase, targetQuery] = targetPath.split('?');
      if (targetQuery) return currentRoute === targetPath;
      return location.pathname === targetBase || location.pathname.startsWith(`${targetBase}/`);
    },
    [currentRoute, location.pathname],
  );

  const activeSectionKeys = useMemo<NavSectionKey[]>(
    () =>
      visibleSections
        .filter((section) => {
          if (section.directPath) {
            return isPathActive(location.pathname, section.directPath);
          }
          return section.items.some((group) =>
            group.items.some((item) => {
              const base = item.path.split('?')[0];
              return location.pathname === base || location.pathname.startsWith(`${base}/`);
            }),
          );
        })
        .map((section) => section.key),
    [location.pathname, visibleSections],
  );

  const { value: manualSections, save: saveManualSections } = useUserPreference<Record<string, boolean>>(
    user?.id ?? null,
    'sidebar_sections_state',
    {},
  );

  const setManualSections = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      void saveManualSections(updater(manualSections ?? {}));
    },
    [manualSections, saveManualSections],
  );

  const lastPathnameRef = useRef(location.pathname);
  useEffect(() => {
    lastPathnameRef.current = location.pathname;
  }, [location.pathname, activeSectionKeys]);

  const isInsideAdminModule =
    location.pathname === '/administracao' || location.pathname.startsWith('/administracao/');

  const isSectionOpen = useCallback(
    (key: NavSectionKey, options?: { collapsed?: boolean }) => {
      if (options?.collapsed) return false;
      if (key === 'administracao' && isInsideAdminModule) return false;
      const overrides = manualSections ?? {};
      if (key in overrides) return overrides[key];
      // Por padrão, todos os submódulos começam recolhidos.
      // O usuário expande manualmente; a preferência é persistida em
      // `manualSections`. Navegar para uma rota interna não abre mais
      // automaticamente o grupo.
      return false;
    },
    [manualSections, isInsideAdminModule],
  );

  const toggleSection = useCallback(
    (key: NavSectionKey) => {
      const currentlyOpen = isSectionOpen(key);
      setManualSections((prev) => ({ ...prev, [key]: !currentlyOpen }));
    },
    [isSectionOpen, setManualSections],
  );

  return {
    currentRoute,
    activeSectionKeys,
    isItemActive,
    isSectionOpen,
    toggleSection,
    isInsideAdminModule,
  };
}
