import { getDbClient } from "@/lib/db/client";

export async function calculateAverageUptime(vendorId: string, days = 15): Promise<number | null> {
  const db = getDbClient();
  const { rows } = await db.query(
    `SELECT uptime_pct FROM uptime_daily WHERE vendor_id = $1 ORDER BY date DESC LIMIT $2`,
    [vendorId, days]
  );
  
  if (rows.length === 0) return null;
  
  const sum = rows.reduce((acc, row) => acc + Number(row.uptime_pct), 0);
  return Number((sum / rows.length).toFixed(4));
}
