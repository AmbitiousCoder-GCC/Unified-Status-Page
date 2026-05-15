import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { VendorStatus, DayUptime } from "@/types/status";
import { VENDORS_LIST } from "@/lib/vendors";
import { aggregateRateLimit, checkRateLimit } from "@/app/api/rate-limit";
import { z } from "zod";

const VendorIdSchema = z.string().refine(val => VENDORS_LIST.some(v => v.id === val), {
  message: "Unknown vendor ID"
});

export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawVendorId } = await params;
  
  const validationResult = VendorIdSchema.safeParse(rawVendorId);
  if (!validationResult.success) {
    return NextResponse.json({ error: "Unknown vendor ID" }, { status: 404 });
  }
  const vendorId = validationResult.data;

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const { success, reset } = await checkRateLimit(aggregateRateLimit, ip);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() }
    });
  }

  const db = getDbClient();

  try {
    // 1. Get latest status
    const { rows: statusRows } = await db.query(
      `SELECT status, description, last_checked FROM vendor_status WHERE vendor_id = $1`,
      [vendorId]
    );
    
    // 2. Get uptime history (last 15 days)
    const { rows: historyRows } = await db.query(
      `SELECT date::text, uptime_pct as "uptimePct" FROM uptime_daily 
       WHERE vendor_id = $1 
       ORDER BY date DESC LIMIT 15`,
      [vendorId]
    );

    // 3. Get aggregate uptime (15 days)
    const { rows: aggRows } = await db.query(
      `SELECT SUM(total_checks) as total, SUM(failed_checks) as failed 
       FROM uptime_daily 
       WHERE vendor_id = $1 AND date >= CURRENT_DATE - INTERVAL '15 days'`,
      [vendorId]
    );
    
    // 4. Get active incidents
    const { rows: activeIncRows } = await db.query(
      `SELECT * FROM incidents WHERE vendor_id = $1 AND status != 'resolved' ORDER BY created_at DESC`,
      [vendorId]
    );
    
    // 5. Get past resolved incidents (last 5)
    const { rows: pastIncRows } = await db.query(
      `SELECT * FROM incidents WHERE vendor_id = $1 AND status = 'resolved' ORDER BY updated_at DESC LIMIT 5`,
      [vendorId]
    );

    const latestStatus = statusRows.length > 0 ? statusRows[0] : null;
    const fetchedAt = latestStatus ? new Date(latestStatus.last_checked).toISOString() : new Date().toISOString();
    
    function mapStatus(dbStatus: string | null): VendorStatus['overallStatus'] {
      if (!dbStatus) return 'unknown';
      const lower = dbStatus.toLowerCase();
      if (lower === 'operational') return 'operational';
      if (lower === 'degraded') return 'degraded';
      if (lower === 'outage') return 'major_outage';
      return 'unknown';
    }

    const overallStatus = mapStatus(latestStatus?.status);
    
    const total = Number(aggRows[0]?.total || 0);
    const failed = Number(aggRows[0]?.failed || 0);
    const uptimePct15d = total > 0 ? Number((((total - failed) / total) * 100).toFixed(2)) : 100;

    const statusData: VendorStatus = {
      vendorId,
      fetchedAt,
      overallStatus,
      statusDescription: latestStatus?.description || (overallStatus === 'operational' ? 'All Systems Operational' : `Current status: ${overallStatus}`),
      uptimePct15d,
      uptimeHistory: historyRows.reverse().map(h => ({
        date: h.date,
        uptimePct: Number(h.uptimePct)
      })),
      activeIncidents: activeIncRows.map(mapIncidentFromDb),
      pastIncidents: pastIncRows.map(mapIncidentFromDb),
      scheduledMaintenances: [],
      components: []
    };

    return NextResponse.json(statusData, {
      headers: { "Cache-Control": "max-age=30" },
    });

  } catch (error: unknown) {
    console.error(`Error fetching status for ${vendorId}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function mapIncidentFromDb(row: Record<string, unknown>): import('@/types/status').Incident {
  return {
    id: String(row.id || ''),
    title: String(row.name || ''),
    severity: (String(row.impact || 'minor')) as 'critical' | 'major' | 'minor' | 'maintenance',
    status: (String(row.status || 'investigating')) as 'investigating' | 'identified' | 'monitoring' | 'resolved',
    startedAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    resolvedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
    affectedComponents: [],
    updates: [],
    url: ''
  };
}
