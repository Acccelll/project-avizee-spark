import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavSection } from '@/lib/navigation';
import { BADGE_TONE_CLASS, type BadgeInfo } from '@/hooks/useSidebarBadges';
import { SidebarSectionItem } from './SidebarSectionItem';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SidebarSectionProps {
  section: NavSection;
  collapsed: boolean;
  isOpen: boolean;
  isActive: boolean;
  isInsideAdminModule: boolean;
  moduleBadge?: BadgeInfo;
  itemBadges: Record<string, BadgeInfo>;
  isItemActive: (path: string) => boolean;
  isFavorito: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onToggleSection: () => void;
  onToggleFavorite: (path: string) => void;
  /** @deprecated mantido por compatibilidade — flyout substitui expand do trilho */
  onExpandRail?: () => void;
}

export function SidebarSection({
  section,
  collapsed,
  isOpen,
  isActive,
  isInsideAdminModule,
  moduleBadge,
  itemBadges,
  isItemActive,
  isFavorito,
  onNavigate,
  onToggleSection,
  onToggleFavorite,
  onExpandRail,
}: SidebarSectionProps) {
  const moduleBadgeCount = moduleBadge?.count ?? 0;
  const moduleBadgeTone = moduleBadge?.tone ?? 'info';

  // Direct-link section (Social, Relatórios) — no expand/collapse
  if (section.directPath) {
    const isDisabled = Boolean(section.disabled);
    return (
      <button
        type="button"
        onClick={() => {
          if (isDisabled) return;
          onNavigate(section.directPath!);
        }}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          isActive ? 'sidebar-item-active' : 'text-foreground hover:bg-accent'
        } ${collapsed ? 'justify-center px-0' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        title={collapsed ? `${section.title}${section.badge ? ` — ${section.badge}` : ''}` : undefined}
        aria-label={collapsed ? `Abrir ${section.title}` : undefined}
      >
        {collapsed && isActive && (
          <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
        )}
        <section.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
        {!collapsed && <span className="flex-1">{section.title}</span>}
        {!collapsed && section.badge && (
          <span className="ml-auto inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.badge}
          </span>
        )}
      </button>
    );
  }

  const showChevron = !(section.key === 'administracao' && isInsideAdminModule);

  // Colapsado: usar Popover flyout em vez de expandir o trilho inteiro.
  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Abrir seção ${section.title}`}
            title={section.title}
            className={`relative flex w-full items-center justify-center gap-3 rounded-lg px-0 py-2 text-left text-sm font-medium transition ${
              isActive ? 'sidebar-section-active' : 'text-foreground hover:bg-accent'
            }`}
          >
            {isActive && (
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
            )}
            <section.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
            {moduleBadgeCount > 0 && (
              <span
                aria-hidden
                className={`absolute top-1 right-1 h-2 w-2 rounded-full ${BADGE_TONE_CLASS[moduleBadgeTone]}`}
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-60 p-2"
        >
          <div className="mb-2 flex items-center gap-2 border-b border-border/40 px-2 pb-2">
            <section.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{section.title}</span>
            {moduleBadgeCount > 0 && (
              <span
                className={`ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${BADGE_TONE_CLASS[moduleBadgeTone]}`}
              >
                {moduleBadgeCount}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            {section.items.map((group) => (
              <Fragment key={group.title}>
                {section.items.length > 1 && (
                  <p className="sidebar-group-label">{group.title}</p>
                )}
                {group.items.map((item) => (
                  <SidebarSectionItem
                    key={item.path}
                    item={item}
                    active={isItemActive(item.path)}
                    badge={itemBadges[item.path]}
                    starred={isFavorito(item.path)}
                    onNavigate={onNavigate}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onToggleSection();
        }}
        aria-expanded={isOpen}
        aria-controls={`sidebar-section-${section.key}`}
        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          isActive ? 'sidebar-section-active' : 'text-foreground hover:bg-accent'
        }`}
      >
        <section.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
        <span className="flex-1">{section.title}</span>
        {moduleBadgeCount > 0 && (
          <span
            className={`ml-auto mr-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${BADGE_TONE_CLASS[moduleBadgeTone]}`}
          >
            {moduleBadgeCount}
          </span>
        )}
        {showChevron &&
          (isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ))}
      </button>

      {isOpen && (
        <div
          id={`sidebar-section-${section.key}`}
          className="ml-2 space-y-0.5 border-l border-border/50 pl-3 py-1"
        >
          {section.items.map((group) => (
            <Fragment key={group.title}>
              {section.items.length > 1 && (
                <p className="sidebar-group-label">{group.title}</p>
              )}
              {group.items.map((item) => (
                <SidebarSectionItem
                  key={item.path}
                  item={item}
                  active={isItemActive(item.path)}
                  badge={itemBadges[item.path]}
                  starred={isFavorito(item.path)}
                  onNavigate={onNavigate}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
