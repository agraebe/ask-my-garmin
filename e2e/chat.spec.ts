/**
 * Chat interaction tests.
 *
 * All tests run as a connected user (auth already handled).
 */

import { test, expect } from '@playwright/test';
import { mockConnected, mockChat, mockChatError } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockConnected(page);
  await mockChat(page);
});

test('user message appears in chat after sending', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/ask about your activities/i).fill('How many miles?');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('How many miles?')).toBeVisible();
});

test('assistant response appears after sending', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/ask about your activities/i).fill('How many miles?');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('This is a streamed response.')).toBeVisible({ timeout: 5000 });
});

test('input is cleared after sending', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/ask about your activities/i);
  await input.fill('How many miles?');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(input).toHaveValue('');
});

test('suggested questions disappear once a message is sent', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ask My Garmin', level: 2 })).toBeVisible();

  await page.getByPlaceholder(/ask about your activities/i).fill('Hello');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(
    page.getByRole('heading', { name: 'Ask My Garmin', level: 2 }),
  ).not.toBeVisible({ timeout: 5000 });
});

test('Enter key submits the message', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/ask about your activities/i).fill('How many miles?');
  await page.keyboard.press('Enter');

  await expect(page.getByText('How many miles?')).toBeVisible();
});

test('Shift+Enter does NOT submit the message', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/ask about your activities/i).fill('Hello');
  await page.keyboard.press('Shift+Enter');

  // Suggested questions (empty state) should still be visible
  await expect(page.getByRole('heading', { name: 'Ask My Garmin', level: 2 })).toBeVisible();
});

test('API error shows error message in chat', async ({ page }) => {
  await mockChatError(page, 503, 'Service unavailable');
  await page.goto('/');

  await page.getByPlaceholder(/ask about your activities/i).fill('test question');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText(/Error:/i)).toBeVisible({ timeout: 5000 });
});

test('clicking a suggested question sends it as a message', async ({ page }) => {
  await page.goto('/');
  await page.getByText('How many miles did I run this week?').click();

  await expect(page.getByText('How many miles did I run this week?')).toBeVisible({
    timeout: 5000,
  });
});

test('Fun Mode toggle switches to RunBot 9000 branding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /fun mode/i }).click();

  await expect(page.getByRole('heading', { name: 'RunBot 9000' })).toBeVisible();
});
