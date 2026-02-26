import { GarminConnect } from 'garmin-connect';
import type { GarminActivity, GarminDailySummary, GarminSleepData } from '@/types';

// Singleton client — reuses the authenticated session across requests in the
// same server process (avoids logging in on every API call).
let client: GarminConnect | null = null;

async function getClient(): Promise<GarminConnect> {
  if (client) return client;

  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'GARMIN_EMAIL and GARMIN_PASSWORD must be set in your .env file'
    );
  }

  client = new GarminConnect({ username: email, password });
  await client.login();
  return client;
}

/** Fetch the most recent activities. */
export async function getRecentActivities(limit = 10): Promise<GarminActivity[]> {
  const gc = await getClient();
  const activities = await gc.getActivities(0, limit);
  return activities as GarminActivity[];
}

/** Fetch the daily summary for a given date (defaults to today). */
export async function getDailySummary(date: Date = new Date()): Promise<GarminDailySummary> {
  const gc = await getClient();
  const summary = await gc.getDaysSummary(date);
  return summary as GarminDailySummary;
}

/** Fetch sleep data for a given date (defaults to last night). */
export async function getSleepData(date: Date = new Date()): Promise<GarminSleepData> {
  const gc = await getClient();
  const sleep = await gc.getSleepData(date);
  return sleep as GarminSleepData;
}

/** Lightweight connectivity check — throws if credentials are wrong. */
export async function checkConnection(): Promise<{ ok: boolean; email: string }> {
  const gc = await getClient();
  const profile = await gc.getUserProfile();
  const email = (profile as { emailAddress?: string }).emailAddress ?? process.env.GARMIN_EMAIL ?? '';
  return { ok: true, email };
}

/** Format seconds into a human-readable duration string (e.g. "1h 23m 45s"). */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/** Convert meters to miles, rounded to 2 decimal places. */
export function metersToMiles(m: number): number {
  return Math.round((m / 1609.344) * 100) / 100;
}
