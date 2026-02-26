import { NextResponse } from 'next/server';
import { getTrainingLoad } from '@/lib/garmin';

export async function GET() {
  try {
    const trainingLoad = await getTrainingLoad();
    
    return NextResponse.json({
      data: trainingLoad,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Training load fetch error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch training load data',
        data: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}