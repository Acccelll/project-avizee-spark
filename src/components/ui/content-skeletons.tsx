import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={`${row}-${col}`} className="h-5 rounded-md bg-muted/70" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: cards }).map((_, idx) => (
        <div key={idx} className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-4 w-1/3 bg-muted/70" />
          <Skeleton className="h-8 w-2/3 bg-muted/70" />
          <Skeleton className="h-3 w-1/2 bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 8 }: { fields?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: fields }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Skeleton className="h-3 w-32 bg-muted/70" />
          <Skeleton className="h-10 w-full bg-muted/70" />
        </div>
      ))}
    </div>
  );
}
