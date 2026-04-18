import { useCallback, useMemo } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, Search } from 'lucide-react';
import logoAvizee from '@/assets/logoavizee.png';
import { Button } from '@/components/ui/button';
import { dashboardItem, flatNavItems } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useVisibleNavSections } from '@/hooks/useVisibleNavSections';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { SidebarFavorites } from '@/components/sidebar/SidebarFavorites';
import { SidebarSection } from '@/components/sidebar/SidebarSection';
import { SidebarFooter } from '@/components/sidebar/SidebarFooter';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onOpenSearch,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();

  const visibleSections = useVisibleNavSections();
  const { activeSectionKeys, isItemActive, isSectionOpen, toggleSection, isInsideAdminModule } =
    useNavigationState(visibleSections);
  const { moduleBadges, itemBadges, secondsSinceSync } = useSidebarBadges();

  // Sidebar collapse preference is owned by AppLayout, but we still consume the
  // user-scoped key here for the sake of any other client that needs it.
  useUserPreference<Record<string, boolean>>(user?.id ?? null, 'sidebar_sections_state', {});

  const favoritedItems = useMemo(
    () => flatNavItems.filter((item) => favoritos.includes(item.path)),
    [favoritos],
  );

  const handleNavClick = useCallback(
    (path: string) => {
      onCloseMobile();
      navigate(path);
    },
    [navigate, onCloseMobile],
  );

  const containerClasses = collapsed ? 'w-[240px] md:w-[72px]' : 'w-[240px]';
  const dashboardActive = location.pathname === dashboardItem.path;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onCloseMobile} />
      )}
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
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
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
        <nav
          className="flex-1 overflow-y-auto px-2 py-3"
          role="navigation"
          aria-label="Módulos do sistema"
        >
          {!collapsed && (
            <SidebarFavorites
              items={favoritedItems}
              isItemActive={isItemActive}
              onNavigate={handleNavClick}
            />
          )}

          {/* Dashboard */}
          <Link
            to={dashboardItem.path}
            onClick={onCloseMobile}
            aria-current={dashboardActive ? 'page' : undefined}
            className={`sidebar-item mb-3 ${dashboardActive ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? dashboardItem.title : undefined}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{dashboardItem.title}</span>}
          </Link>

          {/* Sections */}
          <div className="space-y-1">
            {visibleSections.map((section) => (
              <SidebarSection
                key={section.key}
                section={section}
                collapsed={collapsed}
                isOpen={isSectionOpen(section.key, { collapsed })}
                isActive={activeSectionKeys.includes(section.key)}
                isInsideAdminModule={isInsideAdminModule}
                moduleBadge={moduleBadges[section.key]}
                itemBadges={itemBadges}
                isItemActive={isItemActive}
                isFavorito={isFavorito}
                onNavigate={handleNavClick}
                onToggleSection={() => toggleSection(section.key)}
                onToggleFavorite={toggleFavorito}
                onExpandRail={onToggleCollapsed}
              />
            ))}
          </div>
        </nav>

        <SidebarFooter
          collapsed={collapsed}
          secondsSinceSync={secondsSinceSync}
          onNavigate={handleNavClick}
        />
      </aside>
    </>
  );
}
