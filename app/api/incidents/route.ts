// app/api/incidents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getIncidentCache, getAllLiveStatuses, getAllActiveIncidents, getRecentIncidents } from '@/lib/vendors/incidentStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const vendor = searchParams.get('vendor');
    const type = searchParams.get('type') ?? 'recent'; // 'live' | 'recent' | 'active'

    const cache = await getIncidentCache();

    if (type === 'live') {
      return NextResponse.json({ data: getAllLiveStatuses(cache), fetchedAt: new Date().toISOString() });
    }
    if (type === 'active') {
      return NextResponse.json({ data: getAllActiveIncidents(cache), fetchedAt: new Date().toISOString() });
    }
    // default: recent
    const incidents = getRecentIncidents(cache, vendor, 20);
    return NextResponse.json({ data: incidents, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Bot] /api/incidents error:', err);
    return NextResponse.json({ error: 'Failed to fetch incident data' }, { status: 500 });
  }
}
