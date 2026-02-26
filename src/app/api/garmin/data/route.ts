import { NextResponse } from 'next/server';
import { getRecentActivities, getDailyStats, getSleepData } from '@/lib/garmin';
import type { GarminContext } from '@/types';

// Returns a snapshot of the user's recent Garmin data.
// The /api/ask route also uses this data to provide context to Claude.
export async function GET() {
  const [activitiesResult, dailyResult, sleepResult] = await Promise.allSettled([
    getRecentActivities(10),
    getDailyStats(),
    getSleepData(),
  ]);

  const context: GarminContext = {
    activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value : null,
    dailyStats: dailyResult.status === 'fulfilled' ? dailyResult.value : null,
    sleepData: sleepResult.status === 'fulfilled' ? sleepResult.value : null,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(context);
}
