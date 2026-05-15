import { getDbClient } from '@/lib/db/client';
import { DEPENDENCIES } from '@/lib/dependencies';
import { VENDORS } from '@/lib/vendors';

export interface BotContext {
  dataBlock: string;
  hasData: boolean;
  dataAsOf: string;
  sources: string[];
}

let cachedContext: BotContext | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function buildBotContext(): Promise<BotContext> {
  const now = Date.now();
  if (cachedContext && (now - lastCacheTime < CACHE_TTL)) {
    return cachedContext;
  }

  const db = getDbClient();
  let dataBlock = "## CURRENT VENDOR STATUS\n\n";
  const sources: string[] = [];
  let hasData = false;

  try {
    const { rows: statusRows } = await db.query(
      `SELECT DISTINCT ON (vendor_id) vendor_id, status, timestamp FROM status_checks ORDER BY vendor_id, timestamp DESC`
    );
    
    const { rows: uptimeRows } = await db.query(
      `SELECT vendor_id, AVG(uptime_pct) as avg_uptime FROM uptime_daily WHERE date >= CURRENT_DATE - INTERVAL '15 days' GROUP BY vendor_id`
    );

    const { rows: incidentRows } = await db.query(
      `SELECT vendor_id, COUNT(*) as count FROM incidents WHERE status != 'resolved' GROUP BY vendor_id`
    );

    const uptimeMap = new Map(uptimeRows.map(r => [r.vendor_id, parseFloat(r.avg_uptime)]));
    const incidentMap = new Map(incidentRows.map(r => [r.vendor_id, parseInt(r.count, 10)]));

    if (statusRows.length > 0) hasData = true;

    for (const row of statusRows) {
      const vendorConfig = VENDORS.find(v => v.id === row.vendor_id);
      const name = vendorConfig?.name || row.vendor_id;
      const uptime = uptimeMap.get(row.vendor_id)?.toFixed(2) || '100.00';
      const incCount = incidentMap.get(row.vendor_id) || 0;
      const deps = DEPENDENCIES[row.vendor_id] || [];
      const depsStr = deps.length > 0 ? ` (Depends on: ${deps.join(', ')})` : '';

      let indicator = '🟢';
      if (row.status === 'degraded' || row.status === 'maintenance') indicator = '🟡';
      if (row.status === 'major_outage' || row.status === 'partial_outage') indicator = '🔴';
      if (row.status === 'unknown') indicator = '⚪';

      dataBlock += `${indicator} **${name}**: ${row.status.toUpperCase()} | Uptime (15d): ${uptime}% | Active Incidents: ${incCount}${depsStr}\n`;
      if (vendorConfig) sources.push(vendorConfig.statusUrl);
    }

    cachedContext = {
      dataBlock,
      hasData,
      dataAsOf: new Date().toISOString(),
      sources: Array.from(new Set(sources)).slice(0, 5)
    };
    lastCacheTime = now;

    return cachedContext;
  } catch (error) {
    console.error("Failed to build bot context from DB:", error);
    return {
      dataBlock: "Error retrieving data.",
      hasData: false,
      dataAsOf: new Date().toISOString(),
      sources: []
    };
  }
}
