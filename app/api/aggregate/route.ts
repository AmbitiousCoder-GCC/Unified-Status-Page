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
  // 1. Rate Limiting with Soft Failure
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await checkRateLimit(aggregateRateLimit, ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  } catch (rlError) {
    console.warn("[RateLimit] Upstash connection failed, bypassing rate limit for availability.", rlError);
  }

  const db = getDbClient();

  try {
    // 2. Database Fetch
    let { rows } = await db.query(AGGREGATE_QUERY);

    // 3. Lazy Sync Logic
    try {
      const latestFetchedAt = rows.length > 0 
        ? Math.max(...rows.map(r => r.fetched_at ? new Date(r.fetched_at).getTime() : 0))
        : 0;
      
      const isStale = (Date.now() - latestFetchedAt) > 5 * 60 * 1000;
      
      if (isStale || rows.length === 0) {
         if (rows.length === 0) {
           // Synchronous refresh with timeout for empty DB
           await Promise.race([
             refreshVendorData(),
             new Promise((_, reject) => setTimeout(() => reject(new Error("Refresh Timeout")), 7000))
           ]).catch(e => console.error("[SyncRefresh] Failed:", e));
           
           const fresh = await db.query(AGGREGATE_QUERY);
           rows = fresh.rows;
         } else {
           // Background refresh for stale DB
           refreshVendorData().catch(e => console.error("[BgRefresh] Failed:", e));
         }
      }
    } catch (refreshErr) {
      console.error("[LazySync] Error during refresh logic:", refreshErr);
    }

    // 4. Return Placeholder if still empty (Prevents frontend "Failed to load" error)
    if (rows.length === 0) {
      return NextResponse.json(VENDORS_LIST.map(v => generatePlaceholder(v.id)));
    }

    // 5. Normal Mapping
    const statuses: VendorStatus[] = rows.map(row => {
      const totalChecks = Number(row.total_checks);
      const failedChecks = Number(row.failed_checks);
      const uptimePct15d = totalChecks > 0 
        ? Number((((totalChecks - failedChecks) / totalChecks) * 100).toFixed(2)) 
        : 100;

      return {
        vendorId: row.vendor_id,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : new Date().toISOString(),
        overallStatus: mapStatus(row.latest_status),
        statusDescription: row.description || "System status reported by vendor",
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
    console.error("[Aggregate] Fatal error:", error);
    // 6. ULTIMATE FALLBACK: Return cached/static placeholders so UI doesn't crash
    return NextResponse.json(VENDORS_LIST.map(v => generatePlaceholder(v.id)));
  }
}

function mapStatus(dbStatus: string | null): VendorStatus['overallStatus'] {
  if (!dbStatus) return 'unknown';
  const lower = dbStatus.toLowerCase();
  if (lower === 'operational') return 'operational';
  if (lower === 'degraded') return 'degraded';
  if (lower === 'outage') return 'major_outage';
  return 'unknown';
}

function generatePlaceholder(vendorId: string): VendorStatus {
  return {
    vendorId,
    fetchedAt: new Date().toISOString(),
    overallStatus: "unknown",
    statusDescription: "Data currently calibrating or vendor unreachable.",
    uptimePct15d: 100,
    uptimeHistory: [],
    activeIncidents: [],
    pastIncidents: [],
    scheduledMaintenances: [],
    components: []
  };
}

function mapJsonbIncident(row: Record<string, unknown>): import('@/types/status').Incident {
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    severity: String(row.severity || 'minor') as any,
    status: String(row.status || 'investigating') as any,
    startedAt: row.startedAt ? new Date(String(row.startedAt)).toISOString() : new Date().toISOString(),
    resolvedAt: row.resolvedAt ? new Date(String(row.resolvedAt)).toISOString() : undefined,
    affectedComponents: [],
    updates: [],
    url: ''
  };
}
