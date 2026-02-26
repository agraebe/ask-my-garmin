/**
 * Mock Garmin data used when GARMIN_EMAIL / GARMIN_PASSWORD are not set.
 * Provides realistic-looking fixture data so the app is fully functional
 * without real Garmin credentials (e.g. in CI, staging, or local demo mode).
 */
import type { GarminActivity, GarminDailyStats, GarminSleepData } from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

// Anchor activity dates relative to today so the data always feels fresh.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export const MOCK_ACTIVITIES: GarminActivity[] = [
  {
    activityId: 1001,
    activityName: 'Morning Run',
    activityType: { typeKey: 'running' },
    startTimeLocal: daysAgo(0),
    distance: 8046.72, // ~5 miles
    duration: 2520, // 42 min
    elevationGain: 45,
    averageSpeed: 3.196,
    maxSpeed: 4.1,
  },
  {
    activityId: 1002,
    activityName: 'Lunch Walk',
    activityType: { typeKey: 'walking' },
    startTimeLocal: daysAgo(1),
    distance: 3218.69, // ~2 miles
    duration: 1800, // 30 min
    elevationGain: 12,
    averageSpeed: 1.787,
  },
  {
    activityId: 1003,
    activityName: 'Evening Ride',
    activityType: { typeKey: 'cycling' },
    startTimeLocal: daysAgo(2),
    distance: 32186.9, // ~20 miles
    duration: 4200, // 70 min
    elevationGain: 230,
    averageSpeed: 7.664,
    maxSpeed: 12.5,
  },
  {
    activityId: 1004,
    activityName: 'Long Run',
    activityType: { typeKey: 'running' },
    startTimeLocal: daysAgo(3),
    distance: 16093.4, // ~10 miles
    duration: 5400, // 90 min
    elevationGain: 95,
    averageSpeed: 2.981,
    maxSpeed: 3.9,
  },
  {
    activityId: 1005,
    activityName: 'Strength Training',
    activityType: { typeKey: 'strength_training' },
    startTimeLocal: daysAgo(4),
    distance: 0,
    duration: 3300, // 55 min
    elevationGain: 0,
  },
  {
    activityId: 1006,
    activityName: 'Easy Run',
    activityType: { typeKey: 'running' },
    startTimeLocal: daysAgo(5),
    distance: 6437.38, // ~4 miles
    duration: 2160, // 36 min
    elevationGain: 30,
    averageSpeed: 2.98,
    maxSpeed: 3.7,
  },
  {
    activityId: 1007,
    activityName: 'Mountain Bike',
    activityType: { typeKey: 'mountain_biking' },
    startTimeLocal: daysAgo(6),
    distance: 24140.2, // ~15 miles
    duration: 5100, // 85 min
    elevationGain: 480,
    averageSpeed: 4.733,
    maxSpeed: 11.2,
  },
];

export const MOCK_DAILY_STATS: GarminDailyStats = {
  date: TODAY,
  steps: 8423,
  restingHeartRate: 52,
  maxHeartRate: 174,
  minHeartRate: 44,
  lastSevenDaysAvgRestingHeartRate: 54,
};

export const MOCK_SLEEP_DATA: GarminSleepData = {
  dailySleepDTO: {
    calendarDate: TODAY,
    sleepTimeSeconds: 26640, // ~7h 24m
    deepSleepSeconds: 5400, // 1h 30m
    lightSleepSeconds: 12960, // 3h 36m
    remSleepSeconds: 6480, // 1h 48m
    awakeSleepSeconds: 1800, // 30m
    sleepScores: {
      overall: { value: 76, qualifierKey: 'GOOD' },
    },
  },
  restingHeartRate: 52,
  avgOvernightHrv: 58,
  hrvStatus: 'BALANCED',
};

export function getMockActivities(limit = 10): GarminActivity[] {
  return MOCK_ACTIVITIES.slice(0, limit);
}

export function getMockDailyStats(): GarminDailyStats {
  return { ...MOCK_DAILY_STATS };
}

export function getMockSleepData(): GarminSleepData {
  return { ...MOCK_SLEEP_DATA };
}

export function getMockConnectionStatus(): { ok: boolean; email: string } {
  return { ok: true, email: 'demo@example.com' };
}
