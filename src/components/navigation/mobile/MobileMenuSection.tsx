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
  /** When section is direct-link (no items), render a plain button instead. */
  onDirectNavigate?: (path: string) => void;
}

export function MobileMenuSection({
  section,
  badge,
  isItemActive,
  isFavorite,
  onNavigate,
  onToggleFavorite,
  onDirectNavigate,
}: MobileMenuSectionProps) {
  const Icon = section.icon;
  const hasBadge = (badge?.count ?? 0) > 0;

  // Direct-link section: no accordion
  if (section.directPath && onDirectNavigate) {
    const active = isItemActive(section.directPath);
    return (
      <button
        type="button"
        onClick={() => onDirectNavigate(section.directPath!)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition',
          active
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-foreground hover:bg-accent',
        )}
      >
        {active && (
          <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1 truncate">{section.title}</span>
        {section.badge && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {section.badge}
          </span>
        )}
      </button>
    );
  }

  const allItems: NavLeafItem[] = section.items.flatMap((g) => g.items);
  const hasActiveLeaf = allItems.some((i) => isItemActive(i.path));

  return (
    <AccordionItem value={section.key} className="border-0">
      <AccordionTrigger
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-accent hover:no-underline data-[state=open]:bg-muted/40',
          hasActiveLeaf ? 'text-foreground' : 'text-foreground/90',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', hasActiveLeaf ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1 truncate">{section.title}</span>
        {hasBadge && badge && (
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
              BADGE_TONE_CLASS[badge.tone],
            )}
            aria-label={`${badge.count} alertas`}
          >
            {badge.count > 99 ? '99+' : badge.count}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </AccordionTrigger>
      <AccordionContent className="pb-1 pt-0.5">
        <div className="space-y-0.5 pl-2">
          {allItems.map((item) => {
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
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}