import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Unmount between tests so a leaked component cannot influence the next one.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Auth state lives in localStorage; start every test from a clean slate.
  localStorage.clear();
});

/*
 * Radix primitives (Select, Dropdown, Popover) drive their open/close state
 * through Pointer Events and scroll the active option into view. jsdom
 * implements neither, so without these stubs every menu throws instead of
 * opening -- a limitation of the test environment, not of the components.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// Radix measures available space before positioning a popper.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
