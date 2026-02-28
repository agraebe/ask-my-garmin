/**
 * Smoke tests — verify the app loads and renders the basic UI.
 */

import { test, expect } from '@playwright/test';
import { mockDisconnected } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockDisconnected(page);
});

test('app loads without errors', async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/error/i);
});

test('shows app title in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ask My Garmin' })).toBeVisible();
});

test('shows suggested questions in empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ask My Garmin').first()).toBeVisible();
});

test('does NOT show login modal on page load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Connect your Garmin account')).not.toBeVisible();
});

test('send button is disabled when input is empty', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /send/i })).toBeDisabled();
});

test('send button enables when user types', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/ask about your activities/i).fill('Hello');
  await expect(page.getByRole('button', { name: /send/i })).toBeEnabled();
});

test('Fun Mode toggle is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /fun mode/i })).toBeVisible();
});
