import '@testing-library/jest-dom';

if (typeof globalThis.requestAnimationFrame !== 'function') {
  const raf: (cb: FrameRequestCallback) => number = (cb) => {
    const id = setTimeout(() => cb(0), 0);
    return id as unknown as number;
  };

  const caf: (handle: number) => void = (handle) =>
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);

  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: raf,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: caf,
    writable: true,
    configurable: true,
  });
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {}

  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver as unknown as typeof IntersectionObserver,
  writable: true,
  configurable: true,
});

/*
 * jsdom has no media queries at all, so `window.matchMedia` is simply absent —
 * not a query that answers false, an undefined function. Anything that asks
 * the environment a question about itself (reduced motion, the nav's collapse
 * breakpoint, reduced transparency) therefore throws on mount rather than
 * taking its default.
 *
 * The stub answers "no" to everything and carries a real listener list, which
 * is the right default for a test: a component under test should behave as it
 * does for a reader who has asked for nothing, and one that listens for
 * changes should not have to null-check the thing it listens to.
 */
if (typeof globalThis.matchMedia !== 'function') {
  const matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const list: MediaQueryList = {
      media: query,
      matches: false,
      onchange: null,
      addEventListener: (_type, cb) => listeners.add(cb as (e: MediaQueryListEvent) => void),
      removeEventListener: (_type, cb) =>
        listeners.delete(cb as (e: MediaQueryListEvent) => void),
      dispatchEvent: () => false,
      /* The two deprecated ones are still what several libraries reach for. */
      addListener: (cb) => cb && listeners.add(cb as (e: MediaQueryListEvent) => void),
      removeListener: (cb) => cb && listeners.delete(cb as (e: MediaQueryListEvent) => void),
    };
    return list;
  };

  Object.defineProperty(globalThis, 'matchMedia', {
    value: matchMedia,
    writable: true,
    configurable: true,
  });
}
