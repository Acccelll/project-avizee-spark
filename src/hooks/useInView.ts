import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight hook backed by the native IntersectionObserver API.
 * Returns a ref to attach to the target element and a boolean `inView`.
 *
 * @param options  Standard IntersectionObserver options.  `threshold: 0`
 *                 triggers as soon as any part of the element is visible.
 */
export function useInView<T extends Element = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0 },
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        // Once visible, stop observing to avoid re-renders
        observer.disconnect();
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}
