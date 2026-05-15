import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the mobile Dashboard. Mirrors the mobile layout: sticky compact
 * header → greeting → 7 KPI cards (2-col) → 4 operational cards → AlertStrip →
 * 7 collapsed blocks (header-only).
 */
export function MobileDashboardSkeleton() {
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Sticky compact header */}
      <div className="-mx-4 mb-2 border-b border-border/60 bg-background/95 px-4 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Greeting */}
      <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 mt-1.5" />
      </div>

      {/* KPIs 2-col */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Operational 2-col */}
      <div>
        <Skeleton className="h-3 w-32 mb-2" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* AlertStrip */}
      <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-full shrink-0" />
          ))}
        </div>
      </div>

      {/* Collapsed blocks */}
      {['Financeiro', 'Vendas', 'Pendências', 'Comercial', 'Estoque', 'Logística', 'Fiscal'].map((label) => (
        <div key={label} className="bg-card rounded-xl border">
          <div className="flex min-h-[52px] items-center gap-2 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}