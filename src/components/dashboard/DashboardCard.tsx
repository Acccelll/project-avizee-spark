import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title?: string;
  action?: ReactNode;
  loading?: boolean;
  /** Controls the height behaviour of the card.
   *  - 'auto'  → height follows content (default)
   *  - 'fixed' → fills the allocated grid cell (h-full)
   *  - 'full'  → same as 'fixed'
   */
  height?: 'auto' | 'fixed' | 'full';
  /** Visual tone — `hero` aplica gradiente + sombra elevada para o card
   *  principal do Bento; `glass` usa backdrop-blur sobre o background;
   *  `default` é o cartão padrão. */
  tone?: 'default' | 'hero' | 'glass';
  /** Quando true, o card ganha micro-interação de elevação no hover. */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  action,
  loading,
  height = 'auto',
  tone = 'default',
  interactive = false,
  className,
  children,
}: DashboardCardProps) {
  const fillHeight = height !== 'auto';

  return (
    <div
      className={cn(
        'rounded-2xl border flex flex-col',
        tone === 'default' && 'bg-card shadow-soft border-border/70',
        tone === 'hero' && 'bg-gradient-hero shadow-elevated border-border/60',
        tone === 'glass' && 'glass-panel',
        interactive && 'hover-lift cursor-pointer',
        fillHeight && 'h-full',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 border-b border-border/50 shrink-0">
          {title && (
            <h3 className="font-display font-semibold text-foreground text-sm tracking-tight">
              {title}
            </h3>
          )}
          {action && <div className={cn(!title && 'ml-auto')}>{action}</div>}
        </div>
      )}
      <div className={cn('flex flex-col p-3.5', fillHeight ? 'flex-1 min-h-0' : '')}>
        {loading ? <Skeleton className="h-full w-full min-h-[40px]" /> : children}
      </div>
    </div>
  );
}
