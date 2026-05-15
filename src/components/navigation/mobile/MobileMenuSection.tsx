import { useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { NavSection, NavLeafItem } from '@/lib/navigation';
import { BADGE_TONE_CLASS, type BadgeInfo } from '@/hooks/useSidebarBadges';
import { cn } from '@/lib/utils';

interface MobileMenuSectionProps {
  section: NavSection;
  badge?: BadgeInfo;
  isItemActive: (path: string) => boolean;
  isFavorite: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onToggleFavorite: (path: string) => void;
  onDirectNavigate?: (path: string) => void;
  /** DOM id for jump-chip scroll targets in the mobile drawer. */
  anchorId?: string;
}

function badgeLabel(b: BadgeInfo): string {
  if (b.tone === 'danger') return `${b.count} alertas`;
  if (b.tone === 'warning') return `${b.count} pendentes`;
  return `${b.count}`;
}

export function MobileMenuSection({
  section,
  badge,
  isItemActive,
  isFavorite,
  onNavigate,
  onToggleFavorite,
  onDirectNavigate,
  anchorId,
}: MobileMenuSectionProps) {
  const allItems: NavLeafItem[] = section.items.flatMap((g) => g.items);
  const itemCount = allItems.length;
  const hasBadge = (badge?.count ?? 0) > 0;
  const COLLAPSE_THRESHOLD = 4;
  const COLLAPSED_VISIBLE = 3;
  const shouldCollapse = itemCount > COLLAPSE_THRESHOLD;
  const hasActiveLeafLocal = allItems.some((i) => isItemActive(i.path));
  const [showAll, setShowAll] = useState(hasActiveLeafLocal);
  const visibleItems = !shouldCollapse || showAll ? allItems : allItems.slice(0, COLLAPSED_VISIBLE);

  // Direct-link section
  if (section.directPath && onDirectNavigate) {
    const active = isItemActive(section.directPath);
    return (
      <button
        type="button"
        id={anchorId}
        onClick={() => onDirectNavigate(section.directPath!)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider transition',
          active ? 'bg-primary/10 text-primary' : 'text-foreground/80 hover:bg-accent',
        )}
      >
        {active && (
          <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
        )}
        <span className="flex-1 truncate">{section.title}</span>
        {hasBadge && badge ? (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal',
              BADGE_TONE_CLASS[badge.tone],
            )}
          >
            {badgeLabel(badge)}
          </span>
        ) : (
          section.badge && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-muted-foreground">
              {section.badge}
            </span>
          )
        )}
      </button>
    );
  }

  return (
    <AccordionItem value={section.key} id={anchorId} className="border-0 scroll-mt-2">
      <AccordionTrigger
        className={cn(
          'group flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider transition hover:bg-accent hover:no-underline data-[state=open]:bg-muted/40',
          hasActiveLeafLocal ? 'text-foreground' : 'text-foreground/80',
        )}
      >
        <span className="flex-1 truncate">{section.title}</span>
        {hasBadge && badge ? (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal',
              BADGE_TONE_CLASS[badge.tone],
            )}
            aria-label={badgeLabel(badge)}
          >
            {badgeLabel(badge)}
          </span>
        ) : (
          itemCount > 0 && (
            <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          )
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </AccordionTrigger>
      <AccordionContent className="pb-1 pt-0.5">
        <div className="space-y-0.5 pl-2">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon ?? section.icon;
            const active = isItemActive(item.path);
            const starred = isFavorite(item.path);
            return (
              <div key={item.path} className="group/item relative flex items-center">
                {active && (
                  <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
                )}
                <button
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition',
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground/90 hover:bg-accent',
                  )}
                >
                  <ItemIcon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="flex-1 truncate">{item.title}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.path);
                  }}
                  className={cn(
                    'shrink-0 rounded p-1.5 transition hover:bg-accent',
                    starred ? 'opacity-100' : 'opacity-50',
                  )}
                  aria-label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star
                    className={cn(
                      'h-3.5 w-3.5',
                      starred ? 'fill-warning text-warning' : 'text-muted-foreground',
                    )}
                  />
                </button>
              </div>
            );
          })}
          {shouldCollapse && !showAll && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/5 transition"
            >
              Ver mais {itemCount - COLLAPSED_VISIBLE} {itemCount - COLLAPSED_VISIBLE === 1 ? 'item' : 'itens'}
            </button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
