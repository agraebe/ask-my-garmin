import { NextResponse } from 'next/server';
import { getDataSyncSummary } from '@/lib/garmin';

export async function GET() {
  try {
    const syncSummary = await getDataSyncSummary();
    
    return NextResponse.json({
      data: syncSummary,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync summary fetch error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch sync summary',
        data: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}