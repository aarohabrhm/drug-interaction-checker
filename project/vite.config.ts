/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // '.' = project root; the 'VITE_' prefix picks up both .env files and any
  // matching variables already in the environment (CI, platform build config).
  const env = loadEnv(mode, '.', 'VITE_');

  // Fail the build, not the browser. The API origin is inlined at build time,
  // so a production bundle without it would silently ship pointing at
  // localhost:8000 -- i.e. the visitor's own machine.
  if (command === 'build' && mode === 'production' && !env.VITE_API_BASE_URL) {
    throw new Error(
      'VITE_API_BASE_URL is required for a production build. ' +
        'See project/.env.example.'
    );
  }

  return {
    plugins: [react()],
    // Must mirror the `paths` entry in tsconfig.app.json -- TypeScript resolves
    // the alias for type-checking, Vite for the actual bundle, and they are
    // configured separately.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.ts',
      // Test files live next to what they test, under src/.
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
      },
    },
    build: {
      // Surface regressions instead of silently shipping a huge bundle.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Split rarely-changing vendor code out of the app chunk so a code
          // change does not force users to re-download React et al.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            // jsPDF is ~400kB and only needed on the prescription screen; it is
            // additionally imported lazily there so it is fetched on demand.
            pdf: ['jspdf', 'jspdf-autotable'],
          },
        },
      },
    },
  };
});
