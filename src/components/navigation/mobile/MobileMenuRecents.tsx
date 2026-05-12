import { History, ChevronRight } from 'lucide-react';
import type { FlatNavItem } from '@/lib/navigation';

interface MobileMenuRecentsProps {
  items: FlatNavItem[];
  onNavigate: (path: string) => void;
}

export function MobileMenuRecents({ items, onNavigate }: MobileMenuRecentsProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="mobile-menu-recents" className="px-3 pt-3">
      <h3
        id="mobile-menu-recents"
        className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70"
      >
        <History className="h-3 w-3" /> Recentes
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