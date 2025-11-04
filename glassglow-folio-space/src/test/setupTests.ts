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
