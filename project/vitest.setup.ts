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
