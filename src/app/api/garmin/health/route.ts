import { NextResponse } from 'next/server';
import { getHeartRateZones, getRecoveryMetrics } from '@/lib/garmin';

export async function GET() {
  try {
    const [heartRateZones, recoveryMetrics] = await Promise.allSettled([
      getHeartRateZones(),
      getRecoveryMetrics(),
    ]);

    return NextResponse.json({
      heartRateZones: heartRateZones.status === 'fulfilled' ? heartRateZones.value : null,
      recoveryMetrics: recoveryMetrics.status === 'fulfilled' ? recoveryMetrics.value : null,
      fetchedAt: new Date().toISOString(),
      errors: [
        ...(heartRateZones.status === 'rejected' ? [`Heart rate zones: ${heartRateZones.reason}`] : []),
        ...(recoveryMetrics.status === 'rejected' ? [`Recovery metrics: ${recoveryMetrics.reason}`] : []),
      ],
    });
  } catch (error) {
    console.error('Health data fetch error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch health data',
        heartRateZones: null,
        recoveryMetrics: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}