import { useRef, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  /** Minimum pull distance in pixels to trigger refresh. Default: 70 */
  threshold?: number;
}

/**
 * Wraps children with a pull-to-refresh gesture on mobile devices.
 * Displays a spinner when the pull threshold is reached and calls onRefresh.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 70,
}: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;
    // Only start pull when scrolled to top
    if (el.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }
      // Apply rubber-band dampening
      const dampened = Math.min(dy * 0.4, threshold * 1.5);
      setPullDistance(dampened);
    },
    [refreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  if (!isMobile) {
    return <>{children}</>;
  }

  const showIndicator = refreshing || pullDistance > 0;
  const indicatorHeight = refreshing ? 48 : pullDistance;
  const ready = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        aria-hidden="true"
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: showIndicator ? indicatorHeight : 0 }}
      >
        <Loader2
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            refreshing ? "animate-spin" : ready ? "text-primary" : "",
          )}
          style={
            !refreshing
              ? { transform: `rotate(${Math.min((pullDistance / threshold) * 180, 180)}deg)` }
              : undefined
          }
        />
      </div>
      {children}
    </div>
  );
}
