import { Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mobileBottomTabs, getNavSectionKey } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = `${location.pathname}${location.search}`;
  const activeKey = getNavSectionKey(currentRoute);

  return (
    <nav aria-label="Navegação mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => tab.path && navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.title}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
            activeKey === 'menu' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
