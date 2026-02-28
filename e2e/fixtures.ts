/**
 * Shared MSW-style network mocks for Playwright tests.
 *
 * All helpers accept a `page` parameter and call page.route() to intercept
 * requests made by the Next.js app.  Import only what you need per spec.
 */

import type { Page } from '@playwright/test';

// ── Fake tokens ───────────────────────────────────────────────────────────────

export const FAKE_SESSION_TOKEN = 'fake-session-token';
export const FAKE_SESSION_ID = 'fake-session-id';
export const FAKE_EMAIL = 'athlete@example.com';

// ── Auth mocks ────────────────────────────────────────────────────────────────

/** Backend reports no active session → user not connected. */
export async function mockDisconnected(page: Page) {
  await page.route('/api/auth/status*', (route) =>
    route.fulfill({ status: 200, json: { connected: false } })
  );
}

/** Backend reports an active session → user connected as FAKE_EMAIL. */
export async function mockConnected(page: Page) {
  await page.route('/api/auth/status*', (route) =>
    route.fulfill({ status: 200, json: { connected: true, email: FAKE_EMAIL } })
  );
}

/**
 * Login flow mock.
 * - POST /api/auth/login → success with session token.
 * - GET  /api/auth/status → disconnected BEFORE login, connected AFTER.
 *
 * Returns a `triggerLogin()` function — call it after the login form is submitted
 * to flip the status endpoint to connected.
 */
export function setupLoginMocks(page: Page) {
  let loggedIn = false;

  page.route('/api/auth/login', (route) => {
    loggedIn = true;
    route.fulfill({
      status: 200,
      json: { status: 'ok', session_token: FAKE_SESSION_TOKEN },
    });
  });

  page.route('/api/auth/status*', (route) => {
    if (loggedIn) {
      route.fulfill({ status: 200, json: { connected: true, email: FAKE_EMAIL } });
    } else {
      route.fulfill({ status: 200, json: { connected: false } });
    }
  });
}

/** MFA login flow mock (two-step). */
export function setupMfaMocks(page: Page) {
  let mfaStep = false;
  let loggedIn = false;

  page.route('/api/auth/login', (route) => {
    mfaStep = true;
    route.fulfill({
      status: 200,
      json: { status: 'mfa_required', session_id: FAKE_SESSION_ID },
    });
  });

  page.route('/api/auth/mfa', (route) => {
    loggedIn = true;
    mfaStep = false;
    route.fulfill({
      status: 200,
      json: { status: 'ok', session_token: FAKE_SESSION_TOKEN },
    });
  });

  page.route('/api/auth/status*', (route) => {
    if (loggedIn) {
      route.fulfill({ status: 200, json: { connected: true, email: FAKE_EMAIL } });
    } else {
      route.fulfill({ status: 200, json: { connected: false } });
    }
  });

  return { isMfaStep: () => mfaStep };
}

/** Simulate wrong credentials. */
export async function mockLoginFailure(page: Page) {
  await page.route('/api/auth/login', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Invalid username or password' } })
  );
}

/** Logout mock. */
export async function mockLogout(page: Page) {
  await page.route('/api/auth/logout', (route) =>
    route.fulfill({ status: 200, json: { status: 'ok' } })
  );
}

// ── Chat mocks ────────────────────────────────────────────────────────────────

/** Successful streaming chat response. */
export async function mockChat(page: Page, response = 'This is a streamed response.') {
  await page.route('/api/ask', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Session-Token': FAKE_SESSION_TOKEN,
      },
      body: response,
    })
  );
}

/** Chat API error. */
export async function mockChatError(page: Page, status = 503, message = 'Service unavailable') {
  await page.route('/api/ask', (route) => route.fulfill({ status, body: message }));
}
