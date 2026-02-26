import { NextResponse } from 'next/server';
import { checkConnection } from '@/lib/garmin';

export async function GET() {
  try {
    const { ok, email } = await checkConnection();
    return NextResponse.json({ connected: ok, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ connected: false, error: message }, { status: 503 });
  }
}
