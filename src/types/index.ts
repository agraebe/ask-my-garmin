export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Matches the IActivity shape returned by garmin-connect's getActivities()
export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: { typeKey: string };
  startTimeLocal: string;
  distance: number; // meters
  duration: number; // seconds
  elevationGain: number;
  averageSpeed?: number;
  maxSpeed?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  trainingStressScore?: number;
  intensityFactor?: number;
  normalizedPower?: number;
  calories?: number;
  averagePace?: number; // min/mile
  maxPace?: number; // min/mile
  vo2MaxValue?: number;
}

// Combined from getSteps() + getHeartRate() — both are separate calls in garmin-connect
export interface GarminDailyStats {
  date: string;
  steps: number;
  restingHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  lastSevenDaysAvgRestingHeartRate?: number;
}

// Matches the SleepData shape returned by garmin-connect's getSleepData()
export interface GarminSleepData {
  dailySleepDTO?: {
    calendarDate: string;
    sleepTimeSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    sleepScores?: {
      overall?: { value: number; qualifierKey: string };
    };
  };
  restingHeartRate?: number;
  avgOvernightHrv?: number;
  hrvStatus?: string;
}

// Training load computed from activity TSS values
export interface GarminTrainingLoad {
  date: string;
  acuteTrainingLoad: number; // 7-day rolling average TSS
  chronicTrainingLoad: number; // 42-day rolling average TSS
  trainingStressBalance: number; // CTL - ATL
  rampRate: number; // week-over-week CTL change
}

// Heart rate zones derived from user's max HR in their Garmin settings
export interface GarminHeartRateZones {
  zone1Min: number;
  zone1Max: number;
  zone2Min: number;
  zone2Max: number;
  zone3Min: number;
  zone3Max: number;
  zone4Min: number;
  zone4Max: number;
  zone5Min: number;
  zone5Max: number;
  lactateThreshold: number;
  maxHeartRate: number;
}

// Recovery metrics derived from sleep data
export interface GarminRecoveryMetrics {
  date: string;
  sleepScore: number; // 0-100 from Garmin sleep scoring
  avgOvernightHrv?: number; // ms
  hrvStatus?: string; // e.g. 'BALANCED', 'LOW', 'HIGH'
  restingHeartRate?: number;
  trainingReadiness: 'low' | 'moderate' | 'high' | 'optimal';
}

// Snapshot returned by /api/garmin/data
export interface GarminContext {
  activities: GarminActivity[] | null;
  dailyStats: GarminDailyStats | null;
  sleepData: GarminSleepData | null;
  fetchedAt: string;
}
