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

export interface GarminContext {
  activities: GarminActivity[] | null;
  dailyStats: GarminDailyStats | null;
  sleepData: GarminSleepData | null;
  fetchedAt: string;
}
