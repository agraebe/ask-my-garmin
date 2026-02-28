/**
 * Authentication flow tests.
 *
 * Covers: login modal trigger, successful login, pending message auto-send,
 * no-re-login regression, wrong password, 2FA, and logout.
 */

import { test, expect } from '@playwright/test';
import {
  mockDisconnected,
  mockConnected,
  setupLoginMocks,
  setupMfaMocks,
  mockLoginFailure,
  mockLogout,
  mockChat,
  FAKE_EMAIL,
} from './fixtures';

// ── Login modal trigger ───────────────────────────────────────────────────────

test('sending a message while logged out shows login modal', async ({ page }) => {
  setupLoginMocks(page);
  await page.goto('/');

  await page.getByPlaceholder(/ask about your activities/i).fill('How many miles?');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('Connect your Garmin account')).toBeVisible();
});

test('clicking a suggested question while logged out shows login modal', async ({ page }) => {
  setupLoginMocks(page);
  await page.goto('/');

  await page.getByText('How many miles did I run this week?').click();

  await expect(page.getByText('Connect your Garmin account')).toBeVisible();
});

// ── Successful login ──────────────────────────────────────────────────────────

test('successful login closes modal and shows connected status', async ({ page }) => {
  setupLoginMocks(page);
  await mockChat(page);
  await page.goto('/');

  // Trigger login modal
  await page.getByPlaceholder(/ask about your activities/i).fill('test');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText('Connect your Garmin account')).toBeVisible();

  // Submit credentials
  await page.getByLabel('Email').fill('athlete@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Modal should close
  await expect(page.getByText('Connect your Garmin account')).not.toBeVisible();
});

test('pending question is auto-sent after login', async ({ page }) => {
  setupLoginMocks(page);
  await mockChat(page, 'You ran 25 miles this week.');
  await page.goto('/');

  // Type a question and hit send (triggers login modal)
  await page.getByPlaceholder(/ask about your activities/i).fill('How many miles?');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText('Connect your Garmin account')).toBeVisible();

  // Log in
  await page.getByLabel('Email').fill('athlete@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  // The original question should appear in the chat
  await expect(page.getByText('How many miles?')).toBeVisible({ timeout: 5000 });
  // And receive a response
  await expect(page.getByText('You ran 25 miles this week.')).toBeVisible({ timeout: 5000 });
});

test('second message sends without re-login (regression: login loop)', async ({ page }) => {
  setupLoginMocks(page);
  await mockChat(page, 'Great workout!');
  await page.goto('/');

  // Login flow for first message
  await page.getByPlaceholder(/ask about your activities/i).fill('First question');
  await page.getByRole('button', { name: /send/i }).click();
  await page.getByLabel('Email').fill('athlete@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for first exchange to complete
  await expect(page.getByText('Great workout!')).toBeVisible({ timeout: 5000 });

  // Second message should NOT show login modal
  const input = page.getByPlaceholder(/ask about your activities/i);
  await input.fill('Second question');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('Connect your Garmin account')).not.toBeVisible();
  await expect(page.getByText('Second question')).toBeVisible({ timeout: 5000 });
});

// ── Error states ──────────────────────────────────────────────────────────────

test('wrong credentials shows error message', async ({ page }) => {
  await mockDisconnected(page);
  await mockLoginFailure(page);
  await page.goto('/');

  // Open modal by trying to send
  await page.getByPlaceholder(/ask about your activities/i).fill('test');
  await page.getByRole('button', { name: /send/i }).click();

  await page.getByLabel('Email').fill('bad@example.com');
  await page.getByLabel('Password').fill('wrongpass');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Invalid username or password')).toBeVisible();
});

// ── MFA flow ──────────────────────────────────────────────────────────────────

test('2FA flow: advances to MFA step then logs in', async ({ page }) => {
  setupMfaMocks(page);
  await mockChat(page);
  await page.goto('/');

  // Trigger login
  await page.getByPlaceholder(/ask about your activities/i).fill('test');
  await page.getByRole('button', { name: /send/i }).click();

  // Submit credentials → should advance to MFA step
  await page.getByLabel('Email').fill('athlete@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByLabel('Verification code')).toBeVisible();

  // Submit MFA code
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: /verify/i }).click();

  // Modal should close after successful MFA
  await expect(page.getByText('Connect your Garmin account')).not.toBeVisible();
});

test('2FA: Back button returns to credentials step', async ({ page }) => {
  setupMfaMocks(page);
  await page.goto('/');

  await page.getByPlaceholder(/ask about your activities/i).fill('test');
  await page.getByRole('button', { name: /send/i }).click();

  await page.getByLabel('Email').fill('athlete@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByLabel('Verification code')).toBeVisible();
  await page.getByRole('button', { name: /back/i }).click();

  await expect(page.getByLabel('Email')).toBeVisible();
});

// ── Logout ────────────────────────────────────────────────────────────────────

test('logout returns to disconnected state', async ({ page }) => {
  await mockConnected(page);
  await mockLogout(page);
  await page.goto('/');

  // Logged-in state — email badge or "Sign out" should be present
  await expect(page.getByText(FAKE_EMAIL)).toBeVisible();

  await page.getByRole('button', { name: /sign out/i }).click();

  // After logout the email should disappear
  await expect(page.getByText(FAKE_EMAIL)).not.toBeVisible();
});
