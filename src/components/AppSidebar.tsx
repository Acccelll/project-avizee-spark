import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, Search } from 'lucide-react';
import logoAvizee from '@/assets/logoavizee.png';
import { Button } from '@/components/ui/button';
import { dashboardItem, flatNavItems } from '@/lib/navigation';
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
  onOpenSearch: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  onOpenSearch,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();

  const visibleSections = useVisibleNavSections();
  const { activeSectionKeys, isItemActive, isSectionOpen, toggleSection, isInsideAdminModule } =
    useNavigationState(visibleSections);
  const { moduleBadges, itemBadges, secondsSinceSync } = useSidebarBadges();

  const favoritedItems = useMemo(
    () => flatNavItems.filter((item) => favoritos.includes(item.path)),
    [favoritos],
  );

  const handleNavClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const containerClasses = collapsed ? 'w-[72px]' : 'w-[240px]';
  const dashboardActive = location.pathname === dashboardItem.path;

  return (
    <aside
      role="navigation"
      aria-label="Barra lateral principal"
      className={[
        'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-card transition-all duration-200',
        containerClasses,
      ].join(' ')}
    >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src={logoAvizee} alt="AviZee" className="h-8 w-8 rounded object-contain" />
            {!collapsed && (
              <p className="text-sm font-semibold tracking-tight">AviZee</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-7 w-7 md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
          </Button>
        </div>

        {/* Search */}
        <div className="px-2 py-2.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className={`flex w-full items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground ${collapsed ? 'justify-center px-0' : ''}`}
            title="Buscar módulos (Ctrl/Cmd + K)"
            aria-label="Abrir busca global"
          >
            <Search className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">Buscar...</span>
                <span className="text-[10px] font-medium text-muted-foreground/70">⌘K</span>
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
            className={`sidebar-item mb-2 ${dashboardActive ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? dashboardItem.title : undefined}
          >
            {collapsed && dashboardActive && (
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
            )}
            <LayoutDashboard className={`h-[18px] w-[18px] shrink-0 ${dashboardActive ? 'text-primary' : ''}`} />
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
