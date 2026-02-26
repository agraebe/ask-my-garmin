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

// Training load and fitness metrics
export interface GarminTrainingLoad {
  date: string;
  acuteTrainingLoad: number;
  chronicTrainingLoad: number;
  trainingStressBalance: number;
  rampRate: number;
}

// Heart rate zones and thresholds
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

// Recovery and wellness metrics
export interface GarminRecoveryMetrics {
  date: string;
  stressLevel: number; // 0-100
  bodyBattery: number; // 0-100
  vo2Max: number;
  fitnessAge: number;
  recoveryTime: number; // hours
  trainingReadiness: 'low' | 'moderate' | 'high' | 'optimal';
}

// Comprehensive context for all Garmin data
export interface GarminContext {
  activities: GarminActivity[] | null;
  dailyStats: GarminDailyStats | null;
  sleepData: GarminSleepData | null;
  trainingLoad: GarminTrainingLoad[] | null;
  heartRateZones: GarminHeartRateZones | null;
  recoveryMetrics: GarminRecoveryMetrics[] | null;
  fetchedAt: string;
}

// Data sync summary for the data explorer
export interface GarminDataSync {
  lastSyncTime: string;
  filesProcessed: {
    activities: number;
    sleepFiles: number;
    hrFiles: number;
    trainingFiles: number;
  };
  totalActivities: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  errors: string[];
}

// FIT file types
export interface FitFileActivity {
  timestamp: string;
  sport: string;
  subSport?: string;
  totalTimerTime: number;
  totalDistance?: number;
  totalCalories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  totalAscent?: number;
  sessions: FitSession[];
}

export interface FitSession {
  timestamp: string;
  totalElapsedTime: number;
  totalTimerTime: number;
  totalDistance?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  laps: FitLap[];
}

export interface FitLap {
  timestamp: string;
  totalElapsedTime: number;
  totalTimerTime: number;
  totalDistance?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
}
