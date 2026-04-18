import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './navigation/AppHeader';
import { MobileBottomNav } from './navigation/MobileBottomNav';
import { MobileMenu } from './navigation/MobileMenu';
import { MobileQuickActions } from './navigation/MobileQuickActions';
import { RelationalDrawerStack } from './views/RelationalDrawerStack';
import { SkipLink } from './SkipLink';
import { useIsMobile } from '@/hooks/use-mobile';
import { ContrastDevTool } from './accessibility/ContrastDevTool';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';
import { GlobalSearch } from './navigation/GlobalSearch';
import { GlobalShortcutsDialog } from './navigation/GlobalShortcutsDialog';

/**
 * AppLayout
 *
 * Shell global da aplicação. Renderizado UMA vez no topo da árvore de rotas
 * autenticadas (`<Route element={<AppLayout />}>...</Route>`); as páginas-filho
 * aparecem via `<Outlet />`. Sidebar, Header, drawers globais e hotkeys
 * permanecem montados ao trocar de rota.
 */
export function AppLayout() {
  const isMobile = useIsMobile();
  const { sidebarCollapsed: collapsed, saveSidebarCollapsed } = useAppConfigContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Hotkeys globais — registradas uma única vez, sobrevivem a navegação.
  useGlobalHotkeys({
    onOpenSearch: () => setSearchOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />

      <div className="hidden md:block">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => saveSidebarCollapsed(!collapsed)}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </div>

      <div
        className={`min-h-screen transition-[margin] duration-200 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}
      >
        <AppHeader
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
        <main
          id="main-content"
          role="main"
          className="mx-auto max-w-[1600px] px-3 py-4 pb-28 md:px-6 md:py-5 md:pb-5"
        >
          <Outlet />
        </main>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <MobileQuickActions />
      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
      <RelationalDrawerStack />

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <GlobalShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {import.meta.env.DEV && <ContrastDevTool />}
    </div>
  );
}
