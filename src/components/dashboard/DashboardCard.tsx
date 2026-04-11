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
  className?: string;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  action,
  loading,
  height = 'auto',
  className,
  children,
}: DashboardCardProps) {
  const fillHeight = height !== 'auto';

  return (
    <div
      className={cn(
        'bg-card rounded-xl border flex flex-col',
        fillHeight && 'h-full',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60 shrink-0">
          {title && (
            <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          )}
          {action && <div className={cn(!title && 'ml-auto')}>{action}</div>}
        </div>
      )}
      <div className={cn('flex flex-col p-4', fillHeight ? 'flex-1 min-h-0' : '')}>
        {loading ? <Skeleton className="h-full w-full min-h-[120px]" /> : children}
      </div>
    </div>
  );
}
