import {
  LayoutDashboard,
  LucideIcon,
} from 'lucide-react';
import { navSections, dashboardItem } from '@/lib/navigation';

/**
 * Canonical navigation item definition.
 * Used as a stable contract between sidebar, breadcrumbs and command palette.
 */
export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  path: string;
  /** Permission resource key used with `can(permission, 'visualizar')`. */
  permission?: string;
  children?: MenuItem[];
  /** Static badge text/count to display alongside the label. */
  badge?: string | number;
  /**
   * Name of the query/hook that returns a count badge for this item.
   * The sidebar resolves this via `useSidebarAlerts` for supported keys.
   * Supported values: 'financeiro', 'estoque', 'comercial', 'orcamentos'.
   */
  badgeQuery?: string;
  /** Section label (e.g. "Comercial") – populated for leaf items. */
  section?: string;
  /** Sub-group label (e.g. "Pipeline de vendas") – populated for leaf items. */
  subgroup?: string;
}

/**
 * Flat list of all navigable items derived from the nav sections.
 * Represents the single source of truth for routing-aware features
 * such as the command palette, breadcrumbs and favorites.
 */
export const NAVIGATION_ITEMS: MenuItem[] = [
  { label: dashboardItem.title, path: dashboardItem.path, icon: LayoutDashboard },
  ...navSections.flatMap((section): MenuItem[] => {
    if (section.directPath) {
      return [
        {
          label: section.title,
          icon: section.icon,
          path: section.directPath,
          section: section.title,
          subgroup: '',
        },
      ];
    }
    return section.items.flatMap((group) =>
      group.items.map((item): MenuItem => ({
        label: item.title,
        path: item.path,
        section: section.title,
        subgroup: group.title,
      })),
    );
  }),
];

/**
 * Map of path → MenuItem for O(1) lookups.
 */
export const NAVIGATION_ITEMS_BY_PATH = new Map<string, MenuItem>(
  NAVIGATION_ITEMS.map((item) => [item.path.split('?')[0], item]),
);
