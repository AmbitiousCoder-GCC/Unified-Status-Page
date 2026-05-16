import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { VendorStatus, Incident } from "@/types/status";
import { VENDORS_LIST } from "@/lib/vendors";
import { checkRateLimit, aggregateRateLimit } from "../rate-limit";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const { success } = await checkRateLimit(aggregateRateLimit, `agg_${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const db = getDbClient();
    if (!db) {
      throw new Error("Database client not initialized");
    }

    // Optimized query: Standard correlated subqueries instead of sub-selects in FROM clause
    const { rows } = await db.query(`
      SELECT
        v.id as vendor_id,
        v.name,
        vs.status as latest_status,
        vs.description,
        vs.last_checked as fetched_at,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', i.id, 'title', i.name, 'severity', COALESCE(i.impact, 'minor'), 'status', i.status,
            'startedAt', i.created_at, 'resolvedAt', null,
            'affectedComponents', '[]'::jsonb, 'updates', '[]'::jsonb
          ))
          FROM incidents i
          WHERE i.vendor_id = v.id AND i.status != 'resolved'
        ), '[]'::jsonb) as active_incidents,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', i.id, 'title', i.name, 'severity', COALESCE(i.impact, 'minor'), 'status', i.status,
            'startedAt', i.created_at, 'resolvedAt', i.updated_at,
            'affectedComponents', '[]'::jsonb, 'updates', '[]'::jsonb
          ))
          FROM (
            SELECT * FROM incidents 
            WHERE vendor_id = v.id AND status = 'resolved' 
            ORDER BY updated_at DESC LIMIT 5
          ) i
        ), '[]'::jsonb) as past_incidents,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('date', date, 'uptimePct', uptime_pct))
          FROM (
            SELECT * FROM uptime_daily 
            WHERE vendor_id = v.id 
            ORDER BY date DESC LIMIT 15
          ) u
        ), '[]'::jsonb) as uptime_history,
        (SELECT SUM(total_checks) FROM uptime_daily WHERE vendor_id = v.id AND date >= CURRENT_DATE - INTERVAL '15 days') as total_checks,
        (SELECT SUM(failed_checks) FROM uptime_daily WHERE vendor_id = v.id AND date >= CURRENT_DATE - INTERVAL '15 days') as failed_checks
      FROM vendors v
      LEFT JOIN vendor_status vs ON vs.vendor_id = v.id
      ORDER BY v.name ASC
    `);

    if (!rows || rows.length === 0) {
      console.warn("[Aggregate] No vendors found in database.");
      return NextResponse.json(VENDORS_LIST.map(v => generatePlaceholder(v.id, "No vendor data in database")));
    }

    const statuses: VendorStatus[] = rows.map((row: any) => {
      const totalChecks = Number(row.total_checks || 0);
      const failedChecks = Number(row.failed_checks || 0);
      const uptimePct15d = totalChecks > 0 
        ? Number((((totalChecks - failedChecks) / totalChecks) * 100).toFixed(2)) 
        : 100;

      return {
        vendorId: row.vendor_id,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : new Date().toISOString(),
        overallStatus: mapStatus(row.latest_status),
        statusDescription: row.description || (row.latest_status === 'OPERATIONAL' ? "All systems operational" : "Status unknown"),
        uptimePct15d,
        uptimeHistory: (row.uptime_history || []).map((d: any) => ({
            date: String(d.date),
            uptimePct: Number(d.uptimePct)
        })).reverse(),
        activeIncidents: (row.active_incidents || []).map(mapJsonbIncident),
        pastIncidents: (row.past_incidents || []).map(mapJsonbIncident),
        scheduledMaintenances: [],
        components: []
      };
    });

    return NextResponse.json(statuses);

  } catch (error: any) {
    console.error("[Aggregate] Runtime Error:", error);
    // FALLBACK: Return placeholders but include error info. Use 200 to keep UI alive but show error.
    return NextResponse.json(
      VENDORS_LIST.map(v => generatePlaceholder(v.id, `Service unavailable: ${error.message}`)),
      { status: 200 } // We use 200 to allow the frontend to render the placeholder state
    );
  }
}

function mapStatus(dbStatus: string | null): VendorStatus['overallStatus'] {
  if (!dbStatus) return 'unknown';
  const lower = dbStatus.toLowerCase().trim();
  if (lower === 'operational') return 'operational';
  if (lower === 'degraded' || lower === 'partial_outage') return 'degraded';
  if (lower === 'outage' || lower === 'major_outage') return 'major_outage';
  if (lower === 'maintenance') return 'maintenance';
  return 'unknown';
}

function generatePlaceholder(vendorId: string, msg: string): VendorStatus {
  return {
    vendorId,
    fetchedAt: new Date().toISOString(),
    overallStatus: "unknown",
    statusDescription: msg,
    uptimePct15d: 100,
    uptimeHistory: [],
    activeIncidents: [],
    pastIncidents: [],
    scheduledMaintenances: [],
    components: []
  };
}

function mapJsonbIncident(row: any): Incident {
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


