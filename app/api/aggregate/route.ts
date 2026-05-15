import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { VendorStatus, DayUptime } from "@/types/status";
import { VENDORS_LIST, refreshVendorData } from "@/lib/vendors";
import { aggregateRateLimit, checkRateLimit } from "@/app/api/rate-limit";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Single CTE query that fetches all vendor data in 1 round-trip.
 */
const AGGREGATE_QUERY = `
WITH active_incidents AS (
  SELECT vendor_id, jsonb_agg(jsonb_build_object(
    'id', id, 'title', name, 'severity', COALESCE(impact, 'minor'), 'status', status,
    'startedAt', created_at, 'resolvedAt', null,
    'affectedComponents', '[]'::jsonb, 'updates', '[]'::jsonb
  ) ORDER BY created_at DESC) as incidents
  FROM incidents
  WHERE status != 'resolved'
  GROUP BY vendor_id
),
past_incidents AS (
  SELECT vendor_id, jsonb_agg(jsonb_build_object(
    'id', id, 'title', name, 'severity', COALESCE(impact, 'minor'), 'status', status,
    'startedAt', created_at, 'resolvedAt', updated_at,
    'affectedComponents', '[]'::jsonb, 'updates', '[]'::jsonb
  ) ORDER BY updated_at DESC) as incidents
  FROM (
    SELECT *, row_number() OVER (PARTITION BY vendor_id ORDER BY updated_at DESC) as rn
    FROM incidents WHERE status = 'resolved'
  ) t
  WHERE rn <= 5
  GROUP BY vendor_id
),
uptime_history AS (
  SELECT vendor_id, jsonb_agg(jsonb_build_object('date', date, 'uptimePct', uptime_pct) ORDER BY date ASC) as history
  FROM (
    SELECT *, row_number() OVER (PARTITION BY vendor_id ORDER BY date DESC) as rn
    FROM uptime_daily
  ) t
  WHERE rn <= 15
  GROUP BY vendor_id
),
uptime_agg AS (
  SELECT vendor_id,
    SUM(total_checks) as total_checks,
    SUM(failed_checks) as failed_checks
  FROM uptime_daily
  WHERE date >= CURRENT_DATE - INTERVAL '15 days'
  GROUP BY vendor_id
)
SELECT
  v.id as vendor_id,
  v.name,
  vs.status as latest_status,
  vs.description,
  vs.last_checked as fetched_at,
  COALESCE(ai.incidents, '[]'::jsonb) as active_incidents,
  COALESCE(pi.incidents, '[]'::jsonb) as past_incidents,
  COALESCE(uh.history, '[]'::jsonb) as uptime_history,
  COALESCE(ua.total_checks, 0) as total_checks,
  COALESCE(ua.failed_checks, 0) as failed_checks
FROM vendors v
LEFT JOIN vendor_status vs ON vs.vendor_id = v.id
LEFT JOIN active_incidents ai ON ai.vendor_id = v.id
LEFT JOIN past_incidents pi ON pi.vendor_id = v.id
LEFT JOIN uptime_history uh ON uh.vendor_id = v.id
LEFT JOIN uptime_agg ua ON ua.vendor_id = v.id
ORDER BY v.name ASC
`;

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
    let { rows } = await db.query(AGGREGATE_QUERY);

    // --- LAZY REFRESH LOGIC ---
    try {
      const latestFetchedAt = rows.length > 0 
        ? Math.max(...rows.map(r => r.fetched_at ? new Date(r.fetched_at).getTime() : 0))
        : 0;
      
      const isStale = (Date.now() - latestFetchedAt) > 5 * 60 * 1000;
      
      if (isStale || rows.length === 0) {
         console.log(`[Lazy Refresh] Data is stale or missing. Triggering sync...`);
         
         if (rows.length === 0) {
           // If no data exists, try to refresh but with a safety timeout
           await Promise.race([
             refreshVendorData(),
             new Promise((_, reject) => setTimeout(() => reject(new Error("Refresh timeout")), 8000))
           ]).catch(e => console.error("[Lazy Refresh] Initial sync failed or timed out:", e));
           
           const fresh = await db.query(AGGREGATE_QUERY);
           rows = fresh.rows;
         } else {
           refreshVendorData().catch(e => console.error("[Lazy Refresh] Background sync failed:", e));
         }
      }
    } catch (refreshErr) {
      console.error("[Lazy Refresh] Critical error:", refreshErr);
    }
    // ---------------------------

    if (rows.length === 0) {
      // Fallback logic remains same
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const promises = VENDORS_LIST.map(vendor =>
        fetch(`${baseUrl}/api/status/${vendor.id}`)
          .then(res => res.json() as Promise<VendorStatus>)
          .catch(() => ({
            vendorId: vendor.id,
            fetchedAt: new Date().toISOString(),
            overallStatus: "unknown" as const,
            statusDescription: "Failed to fetch status",
            uptimePct15d: 100,
            uptimeHistory: [],
            activeIncidents: [],
            pastIncidents: [],
            scheduledMaintenances: [],
            components: []
          } satisfies VendorStatus))
      );
      const statuses = await Promise.all(promises);
      return NextResponse.json(statuses);
    }

    function mapStatus(dbStatus: string | null): VendorStatus['overallStatus'] {
      if (!dbStatus) return 'unknown';
      const lower = dbStatus.toLowerCase();
      if (lower === 'operational') return 'operational';
      if (lower === 'degraded') return 'degraded';
      if (lower === 'outage') return 'major_outage';
      return 'unknown';
    }

    const statuses: VendorStatus[] = rows.map(row => {
      const overallStatus = mapStatus(row.latest_status);
      const totalChecks = Number(row.total_checks);
      const failedChecks = Number(row.failed_checks);
      const uptimePct15d = totalChecks > 0 
        ? Number((((totalChecks - failedChecks) / totalChecks) * 100).toFixed(2)) 
        : 100;

      return {
        vendorId: row.vendor_id,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : new Date().toISOString(),
        overallStatus,
        statusDescription: row.description || (overallStatus === 'operational'
          ? 'All Systems Operational'
          : `Current status: ${overallStatus}`),
        uptimePct15d,
        uptimeHistory: (row.uptime_history as DayUptime[]).map(d => ({
            ...d,
            uptimePct: Number(d.uptimePct)
        })),
        activeIncidents: (row.active_incidents as Array<Record<string, unknown>>).map(mapJsonbIncident),
        pastIncidents: (row.past_incidents as Array<Record<string, unknown>>).map(mapJsonbIncident),
        scheduledMaintenances: [],
        components: []
      };
    });

    return NextResponse.json(statuses);
  } catch (error: unknown) {
    console.error("Aggregate error:", error);
    return NextResponse.json({ error: "Failed to aggregate statuses" }, { status: 500 });
  }
}

function mapJsonbIncident(row: Record<string, unknown>): import('@/types/status').Incident {
  const severity = String(row.severity || 'minor') as 'critical' | 'major' | 'minor' | 'maintenance';
  const status = String(row.status || 'investigating') as 'investigating' | 'identified' | 'monitoring' | 'resolved';
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    severity,
    status,
    startedAt: row.startedAt ? new Date(String(row.startedAt)).toISOString() : new Date().toISOString(),
    resolvedAt: row.resolvedAt ? new Date(String(row.resolvedAt)).toISOString() : undefined,
    affectedComponents: [],
    updates: [],
    url: ''
  };
}
