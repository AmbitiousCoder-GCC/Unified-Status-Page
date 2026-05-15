import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { VendorStatus, DayUptime } from "@/types/status";
import { VENDORS } from "@/lib/vendors";
import { aggregateRateLimit, checkRateLimit } from "@/app/api/rate-limit";
import { z } from "zod";

const VendorStatusSchema = z.array(z.object({
  vendorId: z.string(),
  fetchedAt: z.string(),
  overallStatus: z.enum(["operational", "degraded", "partial_outage", "major_outage", "maintenance", "unknown"]),
  statusDescription: z.string(),
  uptimePct15d: z.number(),
  uptimeHistory: z.array(z.object({
    date: z.string(),
    uptimePct: z.number()
  })),
  activeIncidents: z.array(z.any()),
  pastIncidents: z.array(z.any()),
  scheduledMaintenances: z.array(z.any()),
  components: z.array(z.any())
}));

export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: NextRequest) {
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
    const { rows: vendorsRows } = await db.query('SELECT * FROM vendors');
    
    if (vendorsRows.length === 0) {
      console.warn("[WARN] DB is empty. Falling back to live fetching...");
      // For fallback, we'll just redirect to the old logic or simulate it.
      // A full live fetch fallback as requested:
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const promises = VENDORS.map(vendor => 
        fetch(`${baseUrl}/api/status/${vendor.id}`)
          .then(res => res.json() as Promise<VendorStatus>)
          .catch(err => ({
            vendorId: vendor.id,
            fetchedAt: new Date().toISOString(),
            overallStatus: "unknown",
            statusDescription: "Failed to fetch status",
            uptimePct15d: 100,
            uptimeHistory: [],
            activeIncidents: [],
            pastIncidents: [],
            scheduledMaintenances: [],
            components: []
          } as VendorStatus))
      );
      const statuses = await Promise.all(promises);
      return NextResponse.json(statuses, {
        headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
      });
    }

    const statuses: VendorStatus[] = [];

    for (const v of vendorsRows) {
      const { rows: statusRows } = await db.query(
        `SELECT status, timestamp FROM status_checks WHERE vendor_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [v.id]
      );
      
      const { rows: activeIncRows } = await db.query(
        `SELECT * FROM incidents WHERE vendor_id = $1 AND status != 'resolved'`,
        [v.id]
      );
      
      const { rows: pastIncRows } = await db.query(
        `SELECT * FROM incidents WHERE vendor_id = $1 AND status = 'resolved' ORDER BY resolved_at DESC LIMIT 5`,
        [v.id]
      );
      
      const { rows: uptimeRows } = await db.query(
        `SELECT date, uptime_pct FROM uptime_daily WHERE vendor_id = $1 ORDER BY date DESC LIMIT 15`,
        [v.id]
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

      statuses.push({
        vendorId: v.id,
        fetchedAt,
        overallStatus: overallStatus as any,
        statusDescription: overallStatus === 'operational' ? 'All Systems Operational' : `Current status: ${overallStatus}`,
        uptimePct15d,
        uptimeHistory: uptimeHistory.reverse(), // oldest to newest
        activeIncidents: activeIncRows.map(mapIncidentFromDb),
        pastIncidents: pastIncRows.map(mapIncidentFromDb),
        scheduledMaintenances: [], // DB schema didn't explicitly track maintenances, returning empty for now
        components: [] // We don't store components in DB yet based on schema provided
      });
    }

    // Validate response shape with Zod before returning
    const validatedStatuses = VendorStatusSchema.parse(statuses);

    return NextResponse.json(validatedStatuses, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (error: any) {
    console.error("Aggregate error:", error.message);
    return NextResponse.json({ error: "Failed to aggregate statuses" }, { status: 500 });
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
