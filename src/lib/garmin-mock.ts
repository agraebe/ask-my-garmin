/**
 * Mock Garmin data used when GARMIN_EMAIL / GARMIN_PASSWORD are not set.
 * Provides realistic-looking fixture data so the app is fully functional
 * without real Garmin credentials (e.g. in CI, staging, or local demo mode).
 */
import type {
  GarminActivity,
  GarminDailyStats,
  GarminSleepData,
  GarminTrainingLoad,
  GarminHeartRateZones,
  GarminRecoveryMetrics,
} from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

// Anchor activity dates relative to today so the data always feels fresh.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function dateStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
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
    averageHeartRate: 152,
    maxHeartRate: 174,
    trainingStressScore: 85,
    intensityFactor: 0.82,
    calories: 420,
    averagePace: 8.4, // min/mile
    maxPace: 6.2,
    vo2MaxValue: 45.2,
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
    averageHeartRate: 95,
    maxHeartRate: 110,
    calories: 160,
    averagePace: 15.0,
    maxPace: 12.5,
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
    averageHeartRate: 145,
    maxHeartRate: 168,
    trainingStressScore: 120,
    intensityFactor: 0.78,
    normalizedPower: 210,
    calories: 850,
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
    averageHeartRate: 158,
    maxHeartRate: 178,
    trainingStressScore: 145,
    intensityFactor: 0.85,
    calories: 780,
    averagePace: 9.0,
    maxPace: 6.8,
    vo2MaxValue: 44.8,
  },
  {
    activityId: 1005,
    activityName: 'Strength Training',
    activityType: { typeKey: 'strength_training' },
    startTimeLocal: daysAgo(4),
    distance: 0,
    duration: 3300, // 55 min
    elevationGain: 0,
    averageHeartRate: 120,
    maxHeartRate: 155,
    calories: 380,
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
    averageHeartRate: 142,
    maxHeartRate: 160,
    trainingStressScore: 55,
    intensityFactor: 0.76,
    calories: 340,
    averagePace: 9.0,
    maxPace: 7.2,
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
    averageHeartRate: 150,
    maxHeartRate: 172,
    trainingStressScore: 95,
    intensityFactor: 0.8,
    normalizedPower: 185,
    calories: 920,
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

// Training load for the past 30 days computed from mock activities
export const MOCK_TRAINING_LOAD: GarminTrainingLoad[] = Array.from({ length: 30 }, (_, i) => {
  const baseLoad = 40 + Math.sin(i / 7) * 15;
  const ctl = baseLoad + (Math.random() - 0.5) * 10;
  const atl = ctl * (0.8 + Math.random() * 0.4);
  return {
    date: dateStr(29 - i),
    acuteTrainingLoad: Math.round(atl),
    chronicTrainingLoad: Math.round(ctl),
    trainingStressBalance: Math.round(ctl - atl),
    rampRate: Math.round((atl / ctl - 1) * 100),
  };
});

export const MOCK_HEART_RATE_ZONES: GarminHeartRateZones = {
  zone1Min: 50,
  zone1Max: 122, // ~65% of 188 max HR
  zone2Min: 122,
  zone2Max: 141, // ~75%
  zone3Min: 141,
  zone3Max: 160, // ~85%
  zone4Min: 160,
  zone4Max: 178, // ~95%
  zone5Min: 178,
  zone5Max: 188,
  lactateThreshold: 163,
  maxHeartRate: 188,
};

// Recovery metrics for the past 7 days derived from sleep quality
export const MOCK_RECOVERY_METRICS: GarminRecoveryMetrics[] = Array.from({ length: 7 }, (_, i) => {
  const sleepScore = 60 + Math.round(Math.sin(i / 2) * 18 + Math.random() * 10);
  const hrv = 50 + Math.round(Math.sin(i / 3) * 12 + Math.random() * 8);
  const readiness: GarminRecoveryMetrics['trainingReadiness'] =
    sleepScore >= 80
      ? 'optimal'
      : sleepScore >= 65
        ? 'high'
        : sleepScore >= 50
          ? 'moderate'
          : 'low';
  return {
    date: dateStr(6 - i),
    sleepScore,
    avgOvernightHrv: hrv,
    hrvStatus: hrv >= 60 ? 'BALANCED' : hrv >= 45 ? 'LOW' : 'UNBALANCED',
    restingHeartRate: 52 + Math.round((Math.random() - 0.5) * 6),
    trainingReadiness: readiness,
  };
});

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

export function getMockTrainingLoad(): GarminTrainingLoad[] {
  return [...MOCK_TRAINING_LOAD];
}

export function getMockHeartRateZones(): GarminHeartRateZones {
  return { ...MOCK_HEART_RATE_ZONES };
}

export function getMockRecoveryMetrics(): GarminRecoveryMetrics[] {
  return [...MOCK_RECOVERY_METRICS];
}
