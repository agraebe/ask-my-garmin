import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '3000';
// Use || (not ??) so an empty string (e.g. unset GitHub Actions var) falls back to localhost.
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// In CI, BASE_URL must be explicitly set to a real deployment URL.
// If it's missing the tests will hit localhost (nothing running) and fail with
// confusing "Invalid URL" or connection-refused errors.
if (process.env.CI && !process.env.BASE_URL) {
  throw new Error(
    'BASE_URL is not set. In CI, set the VERCEL_PRODUCTION_URL GitHub Actions repository variable ' +
      '(GitHub → Settings → Secrets and variables → Actions → Variables).'
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start Next.js dev server locally unless BASE_URL is provided (e.g. in CI pointing at a deployed preview)
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
