import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Replicate the @/* alias from tsconfig.json without the ESM-only vite-tsconfig-paths
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // Base URL so relative fetch() calls resolve correctly in tests
        url: 'http://localhost:3000',
      },
    },
    globals: false, // import { describe, it, expect } from 'vitest' explicitly
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/app/layout.tsx',
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
