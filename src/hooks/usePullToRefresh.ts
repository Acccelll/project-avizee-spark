import { useCallback, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<unknown>;
  /** Distance in px the user must pull to trigger refresh. Default 70. */
  threshold?: number;
  /** When true, listeners no-op. */
  disabled?: boolean;
}

/**
 * Lightweight pull-to-refresh for mobile dashboards. Tracks touch position and
 * calls `onRefresh` when the user pulls down past `threshold` while at the top
 * of the page. Returns handlers to spread on the scroll container plus a
 * `pullDistance` (clamped to threshold * 1.5) for visual feedback.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  disabled = false,
}: UsePullToRefreshOptions) {
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    },
    [disabled, refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || disabled || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }
      // Resistance: ease past the threshold.
      const eased = Math.min(threshold * 1.5, dy * 0.5);
      setPullDistance(eased);
    },
    [disabled, refreshing, threshold],
  );

  const onTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    const triggered = pullDistance >= threshold;
    startY.current = null;
    setPullDistance(0);
    if (triggered && !disabled && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  }, [disabled, onRefresh, pullDistance, refreshing, threshold]);

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    pullDistance,
    refreshing,
    threshold,
  };
}