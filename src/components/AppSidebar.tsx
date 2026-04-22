import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, Search } from 'lucide-react';
import brandLogotipo from '@/assets/brand-logotipo.png';
import brandSimbolo from '@/assets/brand-simbolo.png';
import { Button } from '@/components/ui/button';
import { dashboardItem, flatNavItems } from '@/lib/navigation';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useVisibleNavSections } from '@/hooks/useVisibleNavSections';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { SidebarFavorites } from '@/components/sidebar/SidebarFavorites';
import { SidebarSection } from '@/components/sidebar/SidebarSection';
import { SidebarFooter } from '@/components/sidebar/SidebarFooter';
import { SidebarBrand } from '@/components/sidebar/SidebarBrand';
import { useAppConfigContext } from '@/contexts/AppConfigContext';

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
  const { branding } = useAppConfigContext();

  const symbolSrc = branding.simboloUrl || brandSimbolo;
  const logoSrc = branding.logoUrl || brandLogotipo;
  const subtitulo = branding.marcaSubtitulo ?? 'ERP';

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
  const transitionClasses =
    'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]';
  const dashboardActive = location.pathname === dashboardItem.path;

  return (
    <aside
      aria-label="Barra lateral principal"
      className={[
        'fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-border bg-card',
        transitionClasses,
        containerClasses,
      ].join(' ')}
    >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-2">
          {collapsed ? (
            <>
              <img src={symbolSrc} alt="Marca" className="h-8 w-8 object-contain ml-1" />
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-7 w-7 md:inline-flex"
                onClick={onToggleCollapsed}
                aria-label="Expandir menu lateral"
                title="Expandir menu lateral"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2 overflow-hidden pl-1">
                <img src={logoSrc} alt={branding.marcaTexto || 'Logotipo'} className="h-8 max-w-[140px] object-contain" />
                {subtitulo && (
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {subtitulo}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-7 w-7 md:inline-flex"
                onClick={onToggleCollapsed}
                aria-label="Recolher menu lateral"
                title="Recolher menu lateral"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </>
          )}
        </div>

        {/* Search */}
        <div className="border-b border-border/40 px-2 py-2.5">
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
  );
}
