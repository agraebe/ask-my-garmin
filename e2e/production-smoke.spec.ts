/**
 * Production smoke tests — real end-to-end tests against the live deployment.
 *
 * Every test in this file makes REAL API calls:
 *   - Real Garmin authentication via the Railway backend
 *   - Real Anthropic/Claude inference
 *   - Real PostgreSQL memory read
 *
 * Run only from the nightly CI workflow. Never during PR checks.
 *
 * Required env vars (set as GitHub Actions secrets):
 *   BASE_URL         — Vercel production URL  (e.g. https://ask-my-garmin.vercel.app)
 *   GARMIN_EMAIL     — Real Garmin Connect account email
 *   GARMIN_PASSWORD  — Real Garmin Connect account password
 */

import { test, expect } from '@playwright/test';

const GARMIN_EMAIL = process.env.GARMIN_EMAIL ?? '';
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD ?? '';
const hasCredentials = !!(GARMIN_EMAIL && GARMIN_PASSWORD);

// ---------------------------------------------------------------------------
// 0. Pre-flight — ensure BASE_URL is configured when running in CI
// ---------------------------------------------------------------------------

test.describe('0. Pre-flight', () => {
  test('BASE_URL is configured (set VERCEL_PRODUCTION_URL in GitHub Actions variables)', () => {
    if (process.env.CI) {
      expect(
        process.env.BASE_URL,
        'VERCEL_PRODUCTION_URL must be set as a GitHub Actions repository variable. ' +
          'Go to Settings → Secrets and variables → Actions → Variables and add VERCEL_PRODUCTION_URL.'
      ).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 1. Infrastructure — no credentials needed
// ---------------------------------------------------------------------------

test.describe('1. Infrastructure', () => {
  test('frontend loads at the production URL', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /ask my garmin/i, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).not.toHaveURL(/\/error/);
  });

  test('auth status endpoint returns valid JSON', async ({ request }) => {
    const res = await request.get('/api/auth/status');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('connected');
    expect(typeof body.connected).toBe('boolean');
  });

  test('login endpoint rejects bad credentials with 401, not 500', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nightly-canary@smoke.invalid', password: 'definitely-not-real' },
      timeout: 15_000,
    });
    // 401 = endpoint alive, validating credentials correctly
    // 429 = rate-limited (still alive)
    // 5xx = server error → test fails correctly
    expect([401, 429]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// 2. Authentication → Garmin data → Claude chat (API-level)
//    Tests run serially so later tests can reuse the session token.
// ---------------------------------------------------------------------------

test.describe.serial('2. Auth + Data + Chat (API)', () => {
  test.skip(!hasCredentials, 'Set GARMIN_EMAIL and GARMIN_PASSWORD to run production smoke tests');

  // Shared across serial tests in this describe block
  let sessionToken = '';

  test('logs in with real Garmin credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: GARMIN_EMAIL, password: GARMIN_PASSWORD },
      timeout: 30_000,
    });

    const body = await res.json();

    if (body.status === 'mfa_required') {
      throw new Error(
        'Garmin account requires MFA — use a non-MFA account for CI (set GARMIN_EMAIL / GARMIN_PASSWORD to a non-MFA Garmin account)'
      );
    }

    expect(res.ok()).toBe(true);
    expect(body.status).toBe('ok');
    expect(typeof body.session_token).toBe('string');
    expect(body.session_token.length).toBeGreaterThan(10);

    sessionToken = body.session_token;
  });

  test('session token validates: status returns connected=true with email', async ({ request }) => {
    expect(sessionToken, 'Requires successful login test').toBeTruthy();

    const res = await request.get(
      `/api/auth/status?session_token=${encodeURIComponent(sessionToken)}`
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.email).toBe(GARMIN_EMAIL);
  });

  test('memories endpoint returns 200 — database is connected', async ({ request }) => {
    expect(sessionToken, 'Requires successful login test').toBeTruthy();

    const res = await request.get('/api/memories', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    // 200 = DB connected
    // 503 = DB down — this is the exact bug we're guarding against
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('memories');
    expect(Array.isArray(body.memories)).toBe(true);
  });

  test('real question returns a non-empty Claude response', async ({ request }) => {
    expect(sessionToken, 'Requires successful login test').toBeTruthy();

    const res = await request.post('/api/ask', {
      data: {
        question: 'Reply with exactly three words: SMOKE TEST PASSED',
        history: [],
        session_token: sessionToken,
        fun_mode: false,
      },
      timeout: 90_000,
    });

    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text.trim().length, 'Claude response must not be empty').toBeGreaterThan(0);
    expect(text, 'Response must not be an error').not.toMatch(/^Error:/i);
  });
});

// ---------------------------------------------------------------------------
// 3. Full UI flow — real browser, real login, real streamed response
// ---------------------------------------------------------------------------

test.describe('3. Full UI flow', () => {
  test.skip(!hasCredentials, 'Set GARMIN_EMAIL and GARMIN_PASSWORD to run production smoke tests');

  test('login via UI and receive a real assistant response', async ({ page }) => {
    test.setTimeout(120_000); // login + Garmin fetch + Claude can take a while

    await page.goto('/');

    // Type a question — the app intercepts it and shows the login modal
    await page
      .getByPlaceholder(/ask about your activities/i)
      .fill('How many activities did I log this week?');
    await page.getByRole('button', { name: /send/i }).click();

    // Login modal must appear
    await expect(page.getByText('Connect your Garmin account')).toBeVisible({ timeout: 5_000 });

    // Enter real credentials
    await page.getByLabel('Email').fill(GARMIN_EMAIL);
    await page.getByLabel('Password').fill(GARMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Modal must close — successful authentication
    await expect(page.getByText('Connect your Garmin account')).not.toBeVisible({
      timeout: 30_000,
    });

    // The question is auto-sent; wait for Claude's response to stream in.
    // We check that the last `.whitespace-pre-wrap` element (the response bubble)
    // has non-empty content and does not start with "Error:".
    const lastBubble = page.locator('.whitespace-pre-wrap').last();
    await expect(lastBubble).not.toBeEmpty({ timeout: 90_000 });

    const responseText = await lastBubble.textContent();
    expect(responseText, 'Response must not be an error').not.toMatch(/^Error:/i);
  });
});
