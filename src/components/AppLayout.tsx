import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './navigation/AppHeader';
import { MobileBottomNav } from './navigation/MobileBottomNav';
import { MobileMenu } from './navigation/MobileMenu';
import { MobileQuickActions } from './navigation/MobileQuickActions';
import { RelationalDrawerStack } from './views/RelationalDrawerStack';
import { SkipLink } from './SkipLink';
import { useIsMobile } from '@/hooks/use-mobile';
import { ContrastDevTool } from './accessibility/ContrastDevTool';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const {
    value: collapsed,
    loading: collapsedLoading,
    save: saveCollapsedPreference,
  } = useUserPreference<boolean>(user?.id, 'sidebar_collapsed', true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchRequested, setSearchRequested] = useState(0);


  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <div className="hidden md:block">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => saveCollapsedPreference(!collapsed)}
          mobileOpen={false}
          onCloseMobile={() => undefined}
          onOpenSearch={() => setSearchRequested((value) => value + 1)}
        />
      </div>

      <div className={`min-h-screen ${collapsedLoading ? '' : 'transition-all duration-200'} ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}>
        <AppHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} searchRequest={searchRequested} />
        <main
          id="main-content"
          role="main"
          className="mx-auto max-w-[1600px] px-3 py-4 pb-28 md:px-6 md:py-6 md:pb-6"
        >
          {children}
        </main>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        onOpenSearch={() => setSearchRequested((value) => value + 1)}
      />
      <MobileQuickActions />
      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
      <RelationalDrawerStack />
      {import.meta.env.DEV && <ContrastDevTool />}
    </div>
  );
}
