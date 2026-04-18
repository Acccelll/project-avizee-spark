import { Star } from 'lucide-react';
import type { FlatNavItem } from '@/lib/navigation';

interface SidebarFavoritesProps {
  items: FlatNavItem[];
  isItemActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}

export function SidebarFavorites({ items, isItemActive, onNavigate }: SidebarFavoritesProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="sidebar-group-label flex items-center gap-1.5">
        <Star className="h-3 w-3 fill-warning text-warning" />
        Favoritos
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isItemActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ${
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary"
                />
              )}
              {Icon && (
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground/70'}`}
                />
              )}
              <span className="truncate">{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
