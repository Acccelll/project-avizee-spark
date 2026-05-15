import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface MobileCollapsibleBlockProps {
  /** Title shown in the collapsed header. */
  title: string;
  /** Icon shown to the left of the title. */
  icon: LucideIcon;
  /** Tailwind text-color class applied to the icon (e.g. "text-primary"). */
  iconColor?: string;
  /** Compact summary shown to the right of the title when collapsed. */
  summary?: ReactNode;
  /** Optional alert/badge node shown next to the title (always visible). */
  badge?: ReactNode;
  /** Whether the block starts open on mobile. Defaults to false. */
  defaultOpen?: boolean;
  /**
   * Stable identifier used to persist the open/closed state per user
   * (preference key `dashboard.collapse.<persistKey>`). When omitted,
   * the state is ephemeral and resets on reload.
   */
  persistKey?: string;
  /** The original block content (rendered as-is on desktop). */
  children: ReactNode;
}

/**
 * On desktop (md+) this renders children unchanged. On mobile it wraps
 * the content in a tappable header with a chevron, dramatically reducing
 * vertical scroll on the dashboard. The original block already has its
 * own card chrome — we only swap the visibility of its body.
 */
export function MobileCollapsibleBlock({
  title,
  icon: Icon,
  iconColor = 'text-primary',
  summary,
  badge,
  defaultOpen = false,
  persistKey,
  children,
}: MobileCollapsibleBlockProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const prefKey = persistKey ? `dashboard.collapse.${persistKey}` : 'dashboard.collapse.__ephemeral__';
  const { value: persistedOpen, save } = useUserPreference<boolean>(
    persistKey ? user?.id ?? null : null,
    prefKey,
    defaultOpen,
  );
  const [open, setOpen] = useState<boolean>(persistedOpen);
  useEffect(() => {
    setOpen(persistedOpen);
  }, [persistedOpen]);
  const debouncedOpen = useDebounce(open, 800);
  useEffect(() => {
    if (debouncedOpen === persistedOpen) return;
    void save(debouncedOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedOpen]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="bg-card rounded-xl border overflow-hidden">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full min-h-[52px] items-center gap-2 px-4 py-3 text-left active:bg-muted/40 transition-colors"
        >
          <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
          <span className="text-sm font-semibold text-foreground shrink-0">{title}</span>
          {badge}
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {!open && summary && (
              <span className="text-xs text-muted-foreground truncate text-right">{summary}</span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                open && 'rotate-180',
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="border-t border-border/60">
          <div className="[&>div]:rounded-none [&>div]:border-0">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}