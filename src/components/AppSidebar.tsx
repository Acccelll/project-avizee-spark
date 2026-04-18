import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Search,
  Settings,
  Star,
} from 'lucide-react';
import logoAvizee from '@/assets/logoavizee.png';
import { Button } from '@/components/ui/button';
import { dashboardItem, flatNavItems, isPathActive, type NavSectionKey } from '@/lib/navigation';
import { useSidebarAlerts } from '@/hooks/useSidebarAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useVisibleNavSections } from '@/hooks/useVisibleNavSections';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, onOpenSearch }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = `${location.pathname}${location.search}`;
  const { user } = useAuth();
  const alerts = useSidebarAlerts();
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();
  const visibleSections = useVisibleNavSections();
  const secondsSinceSync = alerts.lastUpdatedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(alerts.lastUpdatedAt).getTime()) / 1000))
    : null;

  // Module-level badge counts (shown on the collapsed/header button of each section)
  const badgeMap: Partial<Record<NavSectionKey, number>> = useMemo(() => ({
    financeiro: alerts.financeiroVencidos + alerts.financeiroVencer,
    estoque: alerts.estoqueBaixo,
    comercial: alerts.orcamentosPendentes,
  }), [alerts]);

  // Module-level badge tone: danger when overdue items exist, otherwise warning/info
  const badgeToneMap: Partial<Record<NavSectionKey, 'danger' | 'warning' | 'info'>> = useMemo(() => ({
    financeiro: alerts.financeiroVencidos > 0 ? 'danger' : 'info',
    estoque: 'danger',
    comercial: 'warning',
  }), [alerts]);

  // Sub-item badges: keyed by path, applied to specific leaf items
  const itemBadges: Record<string, { count: number; tone: 'danger' | 'warning' | 'info' }> = useMemo(() => ({
    '/orcamentos': { count: alerts.orcamentosPendentes, tone: 'warning' },
    '/financeiro': {
      count: alerts.financeiroVencidos + alerts.financeiroVencer,
      tone: alerts.financeiroVencidos > 0 ? 'danger' : 'info',
    },
    '/estoque': { count: alerts.estoqueBaixo, tone: 'danger' },
  }), [alerts]);

  /**
   * Active-state matcher for a leaf item.
   *  - Items WITHOUT query (e.g. `/orcamentos`): active on the path or any nested path.
   *  - Items WITH query (e.g. `/fiscal?tipo=entrada`): active only on exact match,
   *    so sibling tabs don't both light up.
   */
  const isItemActive = useCallback(
    (targetPath: string) => {
      const [targetBase, targetQuery] = targetPath.split('?');
      if (targetQuery) return currentRoute === targetPath;
      return location.pathname === targetBase || location.pathname.startsWith(`${targetBase}/`);
    },
    [currentRoute, location.pathname],
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

  const moduleBadgeClass = {
    danger: 'bg-destructive text-destructive-foreground',
    warning: 'bg-warning text-warning-foreground',
    info: 'bg-primary text-primary-foreground',
  };

  const toneClass = {
    danger: 'bg-destructive text-destructive-foreground',
    warning: 'bg-warning text-warning-foreground',
    info: 'bg-primary text-primary-foreground',
  };

  /**
   * Section keys whose subtree contains (or directly maps to) the current route.
   * Drives both the module-level "active" highlight and automatic expansion.
   */
  const activeSectionKeys = useMemo(
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

  /**
   * When the user navigates into a section they had previously collapsed manually,
   * clear the manual override so the matching submenu re-opens. Otherwise the user
   * lands on `/orcamentos` with "Comercial" still hidden — confusing for an ERP.
   */
  const lastPathnameRef = useRef(location.pathname);
  useEffect(() => {
    if (lastPathnameRef.current === location.pathname) return;
    lastPathnameRef.current = location.pathname;
    if (activeSectionKeys.length === 0) return;
    const current = manualSections ?? {};
    const overridesToClear = activeSectionKeys.filter((key) => current[key] === false);
    if (overridesToClear.length === 0) return;
    setManualSections((prev) => {
      const next = { ...prev };
      for (const key of overridesToClear) delete next[key];
      return next;
    });
  }, [location.pathname, activeSectionKeys, manualSections, setManualSections]);

  const favoritedItems = useMemo(
    () => flatNavItems.filter((item) => favoritos.includes(item.path)),
    [favoritos],
  );

  const handleStarClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const path = e.currentTarget.dataset.path;
      if (path) toggleFavorito(path);
    },
    [toggleFavorito],
  );

  // Administração has its own local sidebar navigation; suppress global expansion
  // to avoid dual-navigation while the user is inside the module.
  const isInsideAdminModule = location.pathname === '/administracao' ||
    location.pathname.startsWith('/administracao/');

  const isSectionOpen = (key: NavSectionKey) => {
    if (collapsed) return false;
    if (key === 'administracao' && isInsideAdminModule) return false;
    const overrides = manualSections ?? {};
    if (key in overrides) return overrides[key];
    return activeSectionKeys.includes(key);
  };

  const handleNavClick = (path: string) => {
    onCloseMobile();
    navigate(path);
  };

  const containerClasses = collapsed ? 'w-[240px] md:w-[72px]' : 'w-[240px]';

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onCloseMobile} />}
      <aside
        role="complementary"
        aria-label="Barra lateral principal"
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-card transition-all duration-200',
          containerClasses,
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={logoAvizee} alt="AviZee" className="h-9 w-9 rounded object-contain" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">AviZee</p>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">ERP</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-3 py-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className={`flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/30 hover:text-foreground ${collapsed ? 'justify-center px-0' : ''}`}
            title="Buscar módulos (Ctrl/Cmd + K)"
            aria-label="Abrir busca global"
          >
            <Search className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="truncate">Buscar...</span>
                <span className="ml-auto text-[10px]">⌘K</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" role="navigation" aria-label="Módulos do sistema">
          {/* Favorites section */}
          {!collapsed && favoritedItems.length > 0 && (
            <div className="mb-3">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Favoritos
              </p>
              <div className="space-y-0.5">
                {favoritedItems.map((item) => {
                  const active = isItemActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavClick(item.path)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ${
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />
                     <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dashboard */}
          <Link
            to={dashboardItem.path}
            onClick={onCloseMobile}
            aria-current={location.pathname === dashboardItem.path ? 'page' : undefined}
            className={`sidebar-item mb-3 ${location.pathname === dashboardItem.path ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? dashboardItem.title : undefined}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{dashboardItem.title}</span>}
          </Link>

          {/* Sections */}
          <div className="space-y-1">
            {visibleSections.map((section) => {
              const sectionActive = activeSectionKeys.includes(section.key);
              const isOpen = isSectionOpen(section.key);
              const moduleBadgeCount = badgeMap[section.key] ?? 0;
              const moduleBadgeTone = badgeToneMap[section.key] ?? 'info';

              // Direct-link section (e.g. Social, Relatórios) — no expand/collapse
              if (section.directPath) {
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapsed();
                        return;
                      }
                      handleNavClick(section.directPath!);
                    }}
                    aria-current={sectionActive ? 'page' : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      sectionActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? section.title : undefined}
                    aria-label={collapsed ? `Abrir ${section.title}` : undefined}
                  >
                    <section.icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="flex-1">{section.title}</span>}
                  </button>
                );
              }

              // Expandable section
              return (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapsed();
                        return;
                      }
                      setManualSections((c) => ({ ...c, [section.key]: !isOpen }));
                    }}
                    aria-expanded={!collapsed && isOpen}
                    aria-controls={`sidebar-section-${section.key}`}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      sectionActive
                        ? 'text-primary'
                        : 'text-foreground hover:bg-accent'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? section.title : undefined}
                    aria-label={collapsed ? `Abrir seção ${section.title}` : undefined}
                  >
                    <section.icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{section.title}</span>
                        {moduleBadgeCount > 0 && (
                          <span className={`ml-auto mr-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${moduleBadgeClass[moduleBadgeTone]}`}>
                            {moduleBadgeCount}
                          </span>
                        )}
                        {!(section.key === 'administracao' && isInsideAdminModule) && (
                          isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </>
                    )}
                    {collapsed && moduleBadgeCount > 0 && (
                      <span className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${moduleBadgeClass[moduleBadgeTone]}`}>
                        {moduleBadgeCount}
                      </span>
                    )}
                  </button>

                  {!collapsed && isOpen && (
                    <div id={`sidebar-section-${section.key}`} className="ml-3 space-y-0.5 border-l border-border pl-3 py-1">
                      {section.items.map((group) => (
                        <Fragment key={group.title}>
                          {section.items.length > 1 && (
                            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {group.title}
                            </p>
                          )}
                          {group.items.map((item) => {
                            const active = isItemActive(item.path);
                            const badge = itemBadges[item.path];
                            const starred = isFavorito(item.path);
                            return (
                              <div key={item.path} className="group flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleNavClick(item.path)}
                                  className={`flex flex-1 items-center justify-between text-left rounded-md px-3 py-1.5 text-[13px] transition ${
                                    active
                                      ? 'bg-primary/10 font-medium text-primary'
                                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                  }`}
                                >
                                  <span>{item.title}</span>
                                  {(badge?.count ?? 0) > 0 && (
                                    <span className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${toneClass[badge.tone]}`}>
                                      {badge.count}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  data-path={item.path}
                                  onClick={handleStarClick}
                                  className={`shrink-0 rounded p-1 transition-opacity hover:bg-accent ${starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  aria-label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                  title={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                >
                                  <Star className={`h-3 w-3 ${starred ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
                                </button>
                              </div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2">
          {!collapsed && secondsSinceSync !== null && (
            <p className="mb-2 px-2 text-[10px] text-muted-foreground">
              Última sincronização: há {secondsSinceSync}s
            </p>
          )}
          <button
            type="button"
            onClick={() => handleNavClick('/configuracoes')}
            className={`sidebar-item ${isPathActive(location.pathname, '/configuracoes') ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Configurações' : undefined}
            aria-label="Abrir configurações"
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Configurações</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
