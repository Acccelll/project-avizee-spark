import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavSection } from '@/lib/navigation';
import { BADGE_TONE_CLASS, type BadgeInfo } from '@/hooks/useSidebarBadges';
import { SidebarSectionItem } from './SidebarSectionItem';

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
  /** Called when user clicks a collapsed-rail header — sidebar should expand itself */
  onExpandRail: () => void;
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
    return (
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            onExpandRail();
            return;
          }
          onNavigate(section.directPath!);
        }}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
        } ${collapsed ? 'justify-center px-0' : ''}`}
        title={collapsed ? section.title : undefined}
        aria-label={collapsed ? `Abrir ${section.title}` : undefined}
      >
        <section.icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="flex-1">{section.title}</span>}
      </button>
    );
  }

  const showChevron = !(section.key === 'administracao' && isInsideAdminModule);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            onExpandRail();
            return;
          }
          onToggleSection();
        }}
        aria-expanded={!collapsed && isOpen}
        aria-controls={`sidebar-section-${section.key}`}
        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          isActive ? 'text-primary' : 'text-foreground hover:bg-accent'
        } ${collapsed ? 'justify-center px-0' : ''}`}
        title={collapsed ? section.title : undefined}
        aria-label={collapsed ? `Abrir seção ${section.title}` : undefined}
      >
        <section.icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{section.title}</span>
            {moduleBadgeCount > 0 && (
              <span
                className={`ml-auto mr-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${BADGE_TONE_CLASS[moduleBadgeTone]}`}
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
          </>
        )}
        {collapsed && moduleBadgeCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${BADGE_TONE_CLASS[moduleBadgeTone]}`}
          >
            {moduleBadgeCount}
          </span>
        )}
      </button>

      {!collapsed && isOpen && (
        <div
          id={`sidebar-section-${section.key}`}
          className="ml-3 space-y-0.5 border-l border-border pl-3 py-1"
        >
          {section.items.map((group) => (
            <Fragment key={group.title}>
              {section.items.length > 1 && (
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {group.title}
                </p>
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
