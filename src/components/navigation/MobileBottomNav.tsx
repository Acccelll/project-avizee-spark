import { Menu } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mobileBottomTabs, getNavSectionKey, DASHBOARD_KEY } from '@/lib/navigation';
import { useVisibleSectionKeys } from '@/hooks/useVisibleNavSections';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = `${location.pathname}${location.search}`;
  const activeKey = getNavSectionKey(currentRoute);
  const visibleKeys = useVisibleSectionKeys();

  // Always keep "Início" visible; for the rest, only show tabs whose section is allowed.
  const tabs = useMemo(
    () => mobileBottomTabs.filter((tab) => tab.key === DASHBOARD_KEY || visibleKeys.has(tab.key)),
    [visibleKeys],
  );

  return (
    <nav
      aria-label="Navegação mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => tab.path && navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary"
                />
              )}
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/10',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>{tab.title}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors',
            activeKey === 'menu' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {activeKey === 'menu' && (
            <span
              aria-hidden
              className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary"
            />
          )}
          <span
            className={cn(
              'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
              activeKey === 'menu' && 'bg-primary/10',
            )}
          >
            <Menu className="h-5 w-5" />
          </span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
