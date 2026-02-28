/**
 * Service health checks.
 *
 * These tests run against real deployed URLs and are skipped unless the
 * corresponding env vars are set.  They are designed for the nightly workflow
 * to verify that Vercel (frontend) and Railway (backend) are healthy.
 */

import { test, expect } from '@playwright/test';

const VERCEL_URL = process.env.VERCEL_URL;
const RAILWAY_URL = process.env.RAILWAY_URL;

// ── Vercel (Next.js frontend) ─────────────────────────────────────────────────

test('Vercel: frontend loads successfully', async ({ page }) => {
  test.skip(!VERCEL_URL, 'VERCEL_URL not set — skipping live service check');
  await page.goto(VERCEL_URL!);
  await expect(page).not.toHaveURL(/error/i);
  await expect(page.getByRole('heading', { name: /ask my garmin|runbot 9000/i })).toBeVisible({
    timeout: 15_000,
  });
});

test('Vercel: auth status endpoint returns JSON', async ({ request }) => {
  test.skip(!VERCEL_URL, 'VERCEL_URL not set — skipping live service check');
  const res = await request.get(`${VERCEL_URL}/api/auth/status`);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty('connected');
});

// ── Railway (Python backend) ──────────────────────────────────────────────────

test('Railway: backend health check responds', async ({ request }) => {
  test.skip(!RAILWAY_URL, 'RAILWAY_URL not set — skipping live service check');
  const res = await request.get(`${RAILWAY_URL}/api/auth/status`);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty('connected');
});

test('Railway: login endpoint accepts POST', async ({ request }) => {
  test.skip(!RAILWAY_URL, 'RAILWAY_URL not set — skipping live service check');
  // Use obviously invalid credentials — we just need a structured error response (401),
  // not an unhandled exception (500), to confirm the endpoint is alive.
  const res = await request.post(`${RAILWAY_URL}/api/auth/login`, {
    data: { email: 'nightly-health-check@example.com', password: 'not-a-real-password' },
  });
  // Expect 401 (invalid creds) not 500 (server error)
  expect([401, 429]).toContain(res.status());
});
