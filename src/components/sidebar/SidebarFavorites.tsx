import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import type { FlatNavItem } from '@/lib/navigation';

interface SidebarFavoritesProps {
  items: FlatNavItem[];
  isItemActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}

const FAVORITES_HINT_KEY = 'avizee:favorites-hint-dismissed';

export function SidebarFavorites({ items, isItemActive, onNavigate }: SidebarFavoritesProps) {
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(FAVORITES_HINT_KEY) === 'true';
  });

  // Quando o usuário adiciona o primeiro favorito, marcar o hint como dispensado.
  useEffect(() => {
    if (items.length > 0 && !hintDismissed) {
      localStorage.setItem(FAVORITES_HINT_KEY, 'true');
      setHintDismissed(true);
    }
  }, [items.length, hintDismissed]);

  if (items.length === 0) {
    if (hintDismissed) return null;
    return (
      <div className="mb-3 rounded-md border border-dashed border-border/60 bg-muted/30 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="h-3 w-3 fill-warning text-warning" />
            Favoritos
          </p>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(FAVORITES_HINT_KEY, 'true');
              setHintDismissed(true);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Dispensar dica de favoritos"
            title="Dispensar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Passe o mouse sobre um item e clique na <Star className="inline h-3 w-3 align-text-bottom" /> para fixá-lo aqui.
        </p>
      </div>
    );
  }

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
