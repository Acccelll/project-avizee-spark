/**
 * Backwards-compatible shim around `@/lib/navigation`.
 * The single source of truth is `navSections` / `flatNavItems` in `lib/navigation`.
 *
 * Existing consumers may import `MenuItem` / `NAVIGATION_ITEMS` / `NAVIGATION_ITEMS_BY_PATH`
 * from this file — they now derive directly from `flatNavItems`, eliminating the
 * previous duplication of the menu tree.
 */
import type { LucideIcon } from 'lucide-react';
import { flatNavItems, type FlatNavItem } from '@/lib/navigation';

export interface MenuItem {
  /** Display label (alias of title for legacy callers). */
  label: string;
  title: string;
  path: string;
  icon?: LucideIcon;
  section?: string;
  subgroup?: string;
  /** Permission resource key used with `can(permission, 'visualizar')`. */
  permission?: string;
  badge?: string | number;
  badgeQuery?: string;
  children?: MenuItem[];
}

function toMenuItem(item: FlatNavItem): MenuItem {
  return {
    label: item.title,
    title: item.title,
    path: item.path,
    icon: item.icon,
    section: item.section,
    subgroup: item.subgroup,
  };
}

export const NAVIGATION_ITEMS: MenuItem[] = flatNavItems.map(toMenuItem);

export const NAVIGATION_ITEMS_BY_PATH = new Map<string, MenuItem>(
  NAVIGATION_ITEMS.map((item) => [item.path.split('?')[0], item]),
);
