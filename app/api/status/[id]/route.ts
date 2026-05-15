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

  const vendorConfig = VENDORS_LIST.find(v => v.id === vendorId);

  const db = getDbClient();

  try {
    const { rows: vendorsRows } = await db.query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
    
    if (vendorsRows.length === 0) {
      // Fallback if DB not seeded
      return NextResponse.json({ error: "Vendor not initialized in database" }, { status: 404 });
    }

    const { rows: statusRows } = await db.query(
      `SELECT status, timestamp, raw_data FROM status_checks WHERE vendor_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [vendorId]
    );
    
    const { rows: activeIncRows } = await db.query(
      `SELECT * FROM incidents WHERE vendor_id = $1 AND status != 'resolved'`,
      [vendorId]
    );
    
    const { rows: pastIncRows } = await db.query(
      `SELECT * FROM incidents WHERE vendor_id = $1 AND status = 'resolved' ORDER BY resolved_at DESC LIMIT 5`,
      [vendorId]
    );
    
    const { rows: uptimeRows } = await db.query(
      `SELECT date, uptime_pct FROM uptime_daily WHERE vendor_id = $1 ORDER BY date DESC LIMIT 15`,
      [vendorId]
    );

    const latestStatus = statusRows.length > 0 ? statusRows[0] : null;
    const fetchedAt = latestStatus ? new Date(latestStatus.timestamp).toISOString() : new Date().toISOString();
    const overallStatus = latestStatus ? latestStatus.status : 'unknown';

    let uptimePct15d = 100;
    const uptimeHistory: DayUptime[] = uptimeRows.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      uptimePct: Number(row.uptime_pct)
    }));

    if (uptimeHistory.length > 0) {
      uptimePct15d = uptimeHistory.reduce((acc, curr) => acc + curr.uptimePct, 0) / uptimeHistory.length;
    }

    const statusData: VendorStatus = {
      vendorId,
      fetchedAt,
      overallStatus: overallStatus as any,
      statusDescription: overallStatus === 'operational' ? 'All Systems Operational' : `Current status: ${overallStatus}`,
      uptimePct15d,
      uptimeHistory: uptimeHistory.reverse(),
      activeIncidents: activeIncRows.map(mapIncidentFromDb),
      pastIncidents: pastIncRows.map(mapIncidentFromDb),
      scheduledMaintenances: [],
      components: []
    };

    return NextResponse.json(statusData, {
      headers: {
        "Cache-Control": "max-age=30",
      },
    });

  } catch (error: any) {
    console.error(`Error fetching status for ${vendorId} from DB:`, error.message);
    
    return NextResponse.json({
      vendorId,
      fetchedAt: new Date().toISOString(),
      overallStatus: "unknown",
      statusDescription: "Failed to fetch status from database",
      uptimePct15d: 100,
      uptimeHistory: [],
      activeIncidents: [],
      pastIncidents: [],
      scheduledMaintenances: [],
      components: []
    }, { 
      status: 200, 
      headers: { "Cache-Control": "max-age=30" } 
    });
  }
}

function mapIncidentFromDb(row: any) {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
    affectedComponents: row.affected_components || [],
    updates: row.raw_data || [],
    url: ''
  };
}
