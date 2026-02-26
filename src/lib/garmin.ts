import { GarminConnect } from 'garmin-connect';
import type { 
  GarminActivity, 
  GarminDailyStats, 
  GarminSleepData,
  GarminTrainingLoad,
  GarminHeartRateZones,
  GarminRecoveryMetrics,
  GarminDataSync
} from '@/types';
import {
  getMockActivities,
  getMockDailyStats,
  getMockSleepData,
  getMockConnectionStatus,
  getMockTrainingLoad,
  getMockHeartRateZones,
  getMockRecoveryMetrics,
  getMockDataSync,
} from '@/lib/garmin-mock';

// When credentials are absent the app runs in demo mode with mock data.
const MOCK_MODE = !process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD;

// Singleton client — reuses the authenticated session within a warm serverless instance.
// On Vercel, a cold start will trigger a fresh login (adds ~2-3 s on first request).
let client: GarminConnect | null = null;

async function getClient(): Promise<GarminConnect> {
  if (client) return client;

  const email = process.env.GARMIN_EMAIL!;
  const password = process.env.GARMIN_PASSWORD!;

  client = new GarminConnect({ username: email, password });
  await client.login();
  return client;
}

/** Fetch the most recent activities. */
export async function getRecentActivities(limit = 10): Promise<GarminActivity[]> {
  if (MOCK_MODE) return getMockActivities(limit);
  const gc = await getClient();
  const activities = await gc.getActivities(0, limit);
  return activities as unknown as GarminActivity[];
}

/**
 * Fetch today's step count and heart rate summary.
 * garmin-connect has no single "daily summary" endpoint — this combines two calls
 * (getSteps + getHeartRate) with individual Promise.allSettled so one failure
 * doesn't prevent the other from being returned.
 */
export async function getDailyStats(date: Date = new Date()): Promise<GarminDailyStats> {
  if (MOCK_MODE) return getMockDailyStats();
  const gc = await getClient();

  const [stepsResult, hrResult] = await Promise.allSettled([
    gc.getSteps(date),
    gc.getHeartRate(date),
  ]);

  return {
    date: date.toISOString().split('T')[0],
    steps: stepsResult.status === 'fulfilled' ? stepsResult.value : 0,
    restingHeartRate: hrResult.status === 'fulfilled' ? hrResult.value.restingHeartRate : undefined,
    maxHeartRate: hrResult.status === 'fulfilled' ? hrResult.value.maxHeartRate : undefined,
    minHeartRate: hrResult.status === 'fulfilled' ? hrResult.value.minHeartRate : undefined,
    lastSevenDaysAvgRestingHeartRate:
      hrResult.status === 'fulfilled' ? hrResult.value.lastSevenDaysAvgRestingHeartRate : undefined,
  };
}

/** Fetch sleep data for a given date (defaults to last night). */
export async function getSleepData(date: Date = new Date()): Promise<GarminSleepData> {
  if (MOCK_MODE) return getMockSleepData();
  const gc = await getClient();
  const sleep = await gc.getSleepData(date);
  return sleep as unknown as GarminSleepData;
}

/** Lightweight connectivity check — throws if credentials are wrong. */
export async function checkConnection(): Promise<{ ok: boolean; email: string }> {
  if (MOCK_MODE) return getMockConnectionStatus();
  const gc = await getClient();
  const profile = await gc.getUserProfile();
  const email =
    (profile as { emailAddress?: string }).emailAddress ?? process.env.GARMIN_EMAIL ?? '';
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

/** Fetch training load data for the past 30 days. */
export async function getTrainingLoad(): Promise<GarminTrainingLoad[]> {
  if (MOCK_MODE) return getMockTrainingLoad();
  
  // In real implementation, this would call Garmin's training load API
  // For now, return mock data since we don't have real API access
  return getMockTrainingLoad();
}

/** Fetch heart rate zones and lactate threshold. */
export async function getHeartRateZones(): Promise<GarminHeartRateZones> {
  if (MOCK_MODE) return getMockHeartRateZones();
  
  // In real implementation, this would call Garmin's HR zones API
  // For now, return mock data since we don't have real API access
  return getMockHeartRateZones();
}

/** Fetch recovery and wellness metrics for the past 14 days. */
export async function getRecoveryMetrics(): Promise<GarminRecoveryMetrics[]> {
  if (MOCK_MODE) return getMockRecoveryMetrics();
  
  // In real implementation, this would call Garmin's wellness/stress API
  // For now, return mock data since we don't have real API access
  return getMockRecoveryMetrics();
}

/** Get data sync summary showing what files were processed. */
export async function getDataSyncSummary(): Promise<GarminDataSync> {
  if (MOCK_MODE) return getMockDataSync();
  
  // In real implementation, this would track actual file processing
  // For now, return mock data since we don't have real API access
  return getMockDataSync();
}
