export {};

// DOM-specific setup; skipped under node-environment suites (e.g. the
// reference-backend conformance tests, which set @vitest-environment node).
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');

  // Stub ResizeObserver for @tanstack/react-virtual
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

  // JSDOM returns 0 for all rect dimensions, which makes virtualizers render nothing.
  // Patch the prototype to return a default usable rect so virtual lists render in tests.
  const PROTO_RECT: DOMRect = {
    x: 0,
    y: 0,
    width: 1024,
    height: 800,
    top: 0,
    bottom: 800,
    left: 0,
    right: 1024,
    toJSON() {
      return this;
    },
  };
  Element.prototype.getBoundingClientRect = function () {
    return PROTO_RECT;
  };
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1024,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 2000,
  });
}
