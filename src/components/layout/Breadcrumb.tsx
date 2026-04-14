/* eslint-disable react-refresh/only-export-components -- file exports context/variants alongside components */
/**
 * Layout-level Breadcrumb component.
 *
 * Re-exports the canonical AppBreadcrumbs which is integrated in the AppHeader.
 * Import this component from layout context; for the AppHeader specifically,
 * continue importing AppBreadcrumbs directly from the navigation folder.
 */
export { AppBreadcrumbs as Breadcrumb, resolvePageTitle } from "@/components/navigation/AppBreadcrumbs";
