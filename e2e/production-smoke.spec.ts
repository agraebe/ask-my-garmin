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

// Fail fast with a clear message if the production URL is not configured.
// An empty BASE_URL (e.g. when vars.VERCEL_PRODUCTION_URL is unset in GitHub Actions)
// would otherwise cause every test to fail with the cryptic "Cannot navigate to invalid URL".
const BASE_URL = process.env.BASE_URL ?? '';
if (!BASE_URL || BASE_URL.startsWith('http://localhost')) {
  throw new Error(
    'production-smoke.spec.ts requires BASE_URL to be set to the live Vercel deployment URL ' +
      '(e.g. https://ask-my-garmin.vercel.app). ' +
      'Set the VERCEL_PRODUCTION_URL repository variable in GitHub Actions settings.'
  );
}

const GARMIN_EMAIL = process.env.GARMIN_EMAIL ?? '';
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD ?? '';
const hasCredentials = !!(GARMIN_EMAIL && GARMIN_PASSWORD);

// Use a deterministic phrase so we can assert on the assistant response text.
// (Claude output can include punctuation/whitespace, so assertions use regex.)
const SMOKE_QUESTION = 'Reply with exactly three words: SMOKE TEST PASSED';

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
// ---------------------------------------------------------------------------

test.describe('2. Auth + Data + Chat (API)', () => {
  test.skip(!hasCredentials, 'Set GARMIN_EMAIL and GARMIN_PASSWORD to run production smoke tests');

  test('end-to-end API smoke chain works (login -> status -> memories -> ask)', async ({
    request,
  }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { email: GARMIN_EMAIL, password: GARMIN_PASSWORD },
      timeout: 30_000,
    });

    const loginBody = await loginRes.json();

    if (loginBody.status === 'mfa_required') {
      throw new Error(
        'Garmin account requires MFA — use a non-MFA account for CI (set GARMIN_EMAIL / GARMIN_PASSWORD to a non-MFA Garmin account)'
      );
    }

    expect(loginRes.ok()).toBe(true);
    expect(loginBody.status).toBe('ok');
    expect(typeof loginBody.session_token).toBe('string');
    expect(loginBody.session_token.length).toBeGreaterThan(10);

    const sessionToken = loginBody.session_token as string;

    const statusRes = await request.get(
      `/api/auth/status?session_token=${encodeURIComponent(sessionToken)}`
    );
    expect(statusRes.ok()).toBe(true);
    const statusBody = await statusRes.json();
    expect(statusBody.connected).toBe(true);
    expect(statusBody.email).toBe(GARMIN_EMAIL);

    const memoriesRes = await request.get('/api/memories', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    // 200 = DB connected
    // 503 = DB down — this is the exact bug we're guarding against
    expect(memoriesRes.status()).toBe(200);
    const memoriesBody = await memoriesRes.json();
    expect(memoriesBody).toHaveProperty('memories');
    expect(Array.isArray(memoriesBody.memories)).toBe(true);

    const askRes = await request.post('/api/ask', {
      data: {
        question: SMOKE_QUESTION,
        history: [],
        session_token: sessionToken,
        fun_mode: false,
      },
      timeout: 90_000,
    });

    expect(askRes.ok()).toBe(true);
    const text = await askRes.text();
    const trimmed = text.trim();
    expect(trimmed.length, 'Claude response must not be empty').toBeGreaterThan(0);
    expect(text, 'Response must not be an error').not.toMatch(/^Error:/i);
    // Keep it resilient to punctuation/whitespace variations.
    expect(trimmed).toMatch(/SMOKE/i);
    expect(trimmed).toMatch(/TEST/i);
    expect(trimmed).toMatch(/PASSED/i);
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
    await page.getByPlaceholder(/ask about your activities/i).fill(SMOKE_QUESTION);
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
    // The assistant bubble uses `bg-garmin-surface` (user bubbles use `bg-garmin-blue`).
    const assistantBubble = page.locator('div.bg-garmin-surface').last();
    await expect(assistantBubble).toContainText(/SMOKE/i, { timeout: 90_000 });
    await expect(assistantBubble).toContainText(/TEST/i, { timeout: 90_000 });
    await expect(assistantBubble).toContainText(/PASSED/i, { timeout: 90_000 });

    const responseText = await assistantBubble.textContent();
    expect(responseText, 'Response must not be an error').not.toMatch(/^Error:/i);
  });
});
