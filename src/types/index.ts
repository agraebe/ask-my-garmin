export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: { typeKey: string };
  startTimeLocal: string;
  distance: number;       // meters
  duration: number;       // seconds
  averageHR?: number;
  maxHR?: number;
  calories?: number;
  elevationGain?: number;
}

export interface GarminDailySummary {
  calendarDate: string;
  totalSteps: number;
  totalDistanceMeters: number;
  activeKilocalories: number;
  bmrKilocalories: number;
  averageStressLevel?: number;
  restingHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
}

export interface GarminSleepData {
  dailySleepDTO?: {
    calendarDate: string;
    sleepStartTimestampLocal: number;
    sleepEndTimestampLocal: number;
    sleepTimeSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    averageSpO2Value?: number;
    averageRespirationValue?: number;
    sleepScores?: { overall?: { value: number } };
  };
}

export interface GarminContext {
  activities: GarminActivity[] | null;
  dailySummary: GarminDailySummary | null;
  sleepData: GarminSleepData | null;
  fetchedAt: string;
}
