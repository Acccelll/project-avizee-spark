import { Star, ChevronRight } from 'lucide-react';
import { flatNavItems, type FlatNavItem } from '@/lib/navigation';

interface MobileMenuFavoritesProps {
  paths: string[];
  onNavigate: (path: string) => void;
}

const flatByPath = new Map<string, FlatNavItem>(
  flatNavItems.map((item) => [item.path.split('?')[0], item]),
);

export function MobileMenuFavorites({ paths, onNavigate }: MobileMenuFavoritesProps) {
  const items = paths
    .map((p) => flatByPath.get(p.split('?')[0]))
    .filter((item): item is FlatNavItem => Boolean(item));

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="mobile-menu-favorites" className="px-3 pt-3">
      <h3
        id="mobile-menu-favorites"
        className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70"
      >
        <Star className="h-3 w-3 fill-warning text-warning" /> Favoritos
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="flex-1 truncate">{item.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            </button>
          );
        })}
      </div>
    </section>
  );
}