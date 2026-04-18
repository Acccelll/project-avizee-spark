import { Star } from 'lucide-react';
import type { NavLeafItem } from '@/lib/navigation';
import { BADGE_TONE_CLASS, type BadgeInfo } from '@/hooks/useSidebarBadges';

interface SidebarSectionItemProps {
  item: NavLeafItem;
  active: boolean;
  badge?: BadgeInfo;
  starred: boolean;
  onNavigate: (path: string) => void;
  onToggleFavorite: (path: string) => void;
}

export function SidebarSectionItem({
  item,
  active,
  badge,
  starred,
  onNavigate,
  onToggleFavorite,
}: SidebarSectionItemProps) {
  const hasBadge = (badge?.count ?? 0) > 0;
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onNavigate(item.path)}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-1 items-center justify-between text-left rounded-md px-3 py-1.5 text-[13px] transition ${
          active
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <span>{item.title}</span>
        {hasBadge && badge && (
          <span
            className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${BADGE_TONE_CLASS[badge.tone]}`}
          >
            {badge.count}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(item.path);
        }}
        className={`shrink-0 rounded p-1 transition-opacity hover:bg-accent ${
          starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        title={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Star className={`h-3 w-3 ${starred ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
      </button>
    </div>
  );
}
