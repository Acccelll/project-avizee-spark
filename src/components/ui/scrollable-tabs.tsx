import * as React from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * ScrollableTabsList — wrapper sobre <TabsList> com scroll horizontal
 * e indicadores de fade nas bordas em mobile, para sinalizar overflow
 * quando há muitas abas. Em desktop, comporta-se como um TabsList normal.
 *
 * Detecta dinamicamente se há conteúdo escondido à esquerda/direita e
 * mostra gradientes de fade conforme o scroll.
 */
interface ScrollableTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsList> {
  containerClassName?: string;
}

export const ScrollableTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  ScrollableTabsListProps
>(({ className, containerClassName, children, ...props }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(false);

  const updateFades = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeft(scrollLeft > 4);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [updateFades, children]);

  return (
    <div className={cn("relative -mx-1", containerClassName)}>
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-none px-1"
        style={{ scrollbarWidth: "none" }}
      >
        <TabsList
          ref={ref}
          className={cn("inline-flex w-max max-w-none", className)}
          {...props}
        >
          {children}
        </TabsList>
      </div>
      {showLeft && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-background to-transparent"
        />
      )}
      {showRight && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent"
        />
      )}
    </div>
  );
});
ScrollableTabsList.displayName = "ScrollableTabsList";