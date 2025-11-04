import '@testing-library/jest-dom';

// RAF קטן ל-Animate שמדי פעם נדרש
if (!globalThis.requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Polyfill ל-IntersectionObserver בשביל whileInView
class MockIntersectionObserver {
  constructor(_: IntersectionObserverCallback, __?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
