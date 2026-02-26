import { GarminConnect } from 'garmin-connect';
import type {
  GarminActivity,
  GarminDailyStats,
  GarminSleepData,
  GarminTrainingLoad,
  GarminHeartRateZones,
  GarminRecoveryMetrics,
} from '@/types';
import {
  getMockActivities,
  getMockDailyStats,
  getMockSleepData,
  getMockConnectionStatus,
  getMockTrainingLoad,
  getMockHeartRateZones,
  getMockRecoveryMetrics,
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

/**
 * Fetch heart rate zones derived from the user's max HR stored in their Garmin settings.
 * Uses a standard 5-zone percentage model.
 */
export async function getHeartRateZones(): Promise<GarminHeartRateZones> {
  if (MOCK_MODE) return getMockHeartRateZones();
  const gc = await getClient();
  const settings = await gc.getUserSettings();

  type UserData = { maxHeartRate?: number; restingHeartRate?: number };
  const userData = (settings as { userData?: UserData }).userData ?? {};
  const maxHR = userData.maxHeartRate ?? 185;
  const restingHR = userData.restingHeartRate ?? 60;

  return {
    zone1Min: restingHR,
    zone1Max: Math.round(maxHR * 0.6),
    zone2Min: Math.round(maxHR * 0.6),
    zone2Max: Math.round(maxHR * 0.7),
    zone3Min: Math.round(maxHR * 0.7),
    zone3Max: Math.round(maxHR * 0.8),
    zone4Min: Math.round(maxHR * 0.8),
    zone4Max: Math.round(maxHR * 0.9),
    zone5Min: Math.round(maxHR * 0.9),
    zone5Max: maxHR,
    lactateThreshold: Math.round(maxHR * 0.87),
    maxHeartRate: maxHR,
  };
}

/**
 * Compute training load (ATL/CTL/TSB) from the past 90 activities.
 * ATL = 7-day rolling average TSS; CTL = 42-day rolling average TSS.
 * Returns the past 30 days of computed values.
 */
export async function getTrainingLoad(): Promise<GarminTrainingLoad[]> {
  if (MOCK_MODE) return getMockTrainingLoad();
  const gc = await getClient();

  // Fetch enough history to compute a 42-day chronic load
  const activities = await gc.getActivities(0, 90);

  // Sum TSS per calendar day
  const tssByDate = new Map<string, number>();
  for (const a of activities as unknown as GarminActivity[]) {
    const date = a.startTimeLocal.split('T')[0].split(' ')[0];
    tssByDate.set(date, (tssByDate.get(date) ?? 0) + (a.trainingStressScore ?? 0));
  }

  // Build a 42-day window of dates (oldest → newest)
  const windowDays: string[] = [];
  for (let i = 41; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    windowDays.push(d.toISOString().split('T')[0]);
  }

  const result: GarminTrainingLoad[] = [];
  for (let i = 0; i < windowDays.length; i++) {
    const date = windowDays[i];
    const atlSlice = windowDays.slice(Math.max(0, i - 6), i + 1);
    const ctlSlice = windowDays.slice(0, i + 1);
    const atl = atlSlice.reduce((s, d) => s + (tssByDate.get(d) ?? 0), 0) / atlSlice.length;
    const ctl = ctlSlice.reduce((s, d) => s + (tssByDate.get(d) ?? 0), 0) / ctlSlice.length;

    // Ramp rate: this week's ATL vs previous week's ATL
    const prevAtlSlice = windowDays.slice(Math.max(0, i - 13), Math.max(0, i - 6));
    const prevAtl =
      prevAtlSlice.length > 0
        ? prevAtlSlice.reduce((s, d) => s + (tssByDate.get(d) ?? 0), 0) / prevAtlSlice.length
        : atl;
    const rampRate = prevAtl > 0 ? Math.round(((atl - prevAtl) / prevAtl) * 100) : 0;

    result.push({
      date,
      acuteTrainingLoad: Math.round(atl),
      chronicTrainingLoad: Math.round(ctl),
      trainingStressBalance: Math.round(ctl - atl),
      rampRate,
    });
  }

  // Return only the last 30 days
  return result.slice(-30);
}

/**
 * Fetch recovery metrics for the past 7 days by pulling sleep data for each day.
 * Training readiness is derived from the Garmin sleep score and overnight HRV.
 */
export async function getRecoveryMetrics(): Promise<GarminRecoveryMetrics[]> {
  if (MOCK_MODE) return getMockRecoveryMetrics();
  const gc = await getClient();

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });

  const sleepResults = await Promise.allSettled(dates.map((d) => gc.getSleepData(d)));

  return dates
    .map((date, i) => {
      const dateStr = date.toISOString().split('T')[0];
      const result = sleepResults[i];
      if (result.status === 'rejected') {
        return { date: dateStr, sleepScore: 0, trainingReadiness: 'moderate' as const };
      }
      const sleep = result.value as unknown as GarminSleepData;
      const sleepScore = sleep.dailySleepDTO?.sleepScores?.overall?.value ?? 0;
      const readiness: GarminRecoveryMetrics['trainingReadiness'] =
        sleepScore >= 80
          ? 'optimal'
          : sleepScore >= 65
            ? 'high'
            : sleepScore >= 50
              ? 'moderate'
              : 'low';
      return {
        date: dateStr,
        sleepScore,
        avgOvernightHrv: sleep.avgOvernightHrv,
        hrvStatus: sleep.hrvStatus,
        restingHeartRate: sleep.restingHeartRate,
        trainingReadiness: readiness,
      };
    })
    .reverse();
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
