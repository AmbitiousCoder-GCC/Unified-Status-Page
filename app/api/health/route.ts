import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDbClient();
  let dbStatus = "connected";
  let vendorsTracked = 0;
  let lastCronRun = "Never";

  try {
    const { rows: vendorRows } = await db.query('SELECT COUNT(*) as count FROM vendors');
    vendorsTracked = parseInt(vendorRows[0].count, 10);

    const { rows: statusRows } = await db.query('SELECT MAX(timestamp) as last_run FROM status_checks');
    if (statusRows.length > 0 && statusRows[0].last_run) {
      lastCronRun = new Date(statusRows[0].last_run).toISOString();
    }
  } catch (error) {
    console.error("Health check DB error:", error);
    dbStatus = "error";
  }

  return NextResponse.json({
    status: "ok",
    db: dbStatus,
    lastCronRun,
    vendorsTracked
  });
}
