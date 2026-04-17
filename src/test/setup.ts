import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom does not implement IntersectionObserver
if (typeof globalThis.IntersectionObserver === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    private callback: IntersectionObserverCallback;

    constructor(cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {
      this.callback = cb;
    }

    observe(target: Element) {
      this.callback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [{ isIntersecting: true, target, intersectionRatio: 1 } as any],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this as any,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  };
}

// jsdom does not implement ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    constructor(_cb: ResizeObserverCallback) {}
  };
}
