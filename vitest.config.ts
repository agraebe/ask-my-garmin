import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(), // resolves @/* path aliases from tsconfig.json
  ],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // Give the test environment a base URL so relative fetch() calls resolve
        url: 'http://localhost:3000',
      },
    },
    globals: false, // import { describe, it, expect } from 'vitest' explicitly
    setupFiles: ['./src/test/setup.ts'],
    // Co-locate test files with source: src/**/*.test.{ts,tsx}
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/app/layout.tsx',  // boilerplate only
        'src/app/globals.css',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
});
