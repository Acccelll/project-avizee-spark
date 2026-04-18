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
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Favoritos
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isItemActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ${
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />
              <span className="truncate">{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
