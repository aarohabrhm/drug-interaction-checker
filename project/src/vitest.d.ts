/**
 * Loads jest-dom's matcher type augmentations (`toBeInTheDocument`, etc.) for
 * `tsc`.
 *
 * `vitest.setup.ts` imports this at runtime, but it lives outside `src/` and so
 * is not part of the app's TypeScript program. Without this file `npm run
 * build` typechecks the test files and fails on every jest-dom matcher.
 */
import '@testing-library/jest-dom/vitest';
