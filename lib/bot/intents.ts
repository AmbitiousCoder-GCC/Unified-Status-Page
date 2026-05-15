import { getDbClient } from '@/lib/db/client';
import { DEPENDENCIES } from '@/lib/dependencies';
import { VENDORS_LIST } from '@/lib/vendors';

export interface AlertIntent {
  type: 'create_alert';
  vendorId: string;
  thresholdMinutes: number;
}

/**
 * Regex + fuzzy matching to extract alert intent from natural language.
 */
export function parseAlertIntent(question: string): AlertIntent | null {
  const lower = question.toLowerCase();
  if (!lower.includes('alert') && !lower.includes('notify') && !lower.includes('warn')) {
    return null;
  }

  const vendor = VENDORS_LIST.find(v => lower.includes(v.name.toLowerCase()) || lower.includes(v.id.toLowerCase()));
  if (!vendor) return null;

  const minuteMatch = lower.match(/(\d+)\s*(minute|min)/);
  const threshold = minuteMatch ? parseInt(minuteMatch[1], 10) : 5;

  return { type: 'create_alert', vendorId: vendor.id, thresholdMinutes: threshold };
}

/**
 * Executes bot-requested actions (e.g., creating an alert rule in the DB).
 */
export async function executeBotAction(actionData: {
  type?: string;
  vendorId?: string;
  thresholdMinutes?: number;
}): Promise<string> {
  const db = getDbClient();

  if (actionData.type === 'create_alert' && actionData.vendorId) {
    const threshold = actionData.thresholdMinutes || 0;
    try {
      await db.query(
        `INSERT INTO alert_rules (vendor_id, condition_type, threshold_minutes, webhook_url)
         VALUES ($1, 'outage_duration', $2, 'console')`,
        [actionData.vendorId, threshold]
      );
      return `✅ Alert rule created for ${actionData.vendorId} (threshold: ${threshold} min).`;
    } catch (e) {
      console.error("Failed to create alert:", e);
      return `❌ Failed to create alert rule.`;
    }
  }

  return '';
}

/**
 * Root cause analysis — identifies shared infrastructure dependencies
 * when 2+ vendors are simultaneously degraded.
 */
export async function performRootCauseAnalysis(degradedVendors: string[]): Promise<string | null> {
  if (degradedVendors.length < 2) return null;

  const dependencyCounts: Record<string, string[]> = {};

  degradedVendors.forEach(vendor => {
    const deps = DEPENDENCIES[vendor.toLowerCase()] || [];
    deps.forEach(dep => {
      if (!dependencyCounts[dep]) dependencyCounts[dep] = [];
      dependencyCounts[dep].push(vendor);
    });
  });

  for (const [dep, affected] of Object.entries(dependencyCounts)) {
    if (affected.length >= 2) {
      return `Potential root cause identified: ${affected.join(' and ')} both depend on ${dep}.`;
    }
  }

  return null;
}

/**
 * Predictive warning — flags vendors with high recent incident frequency.
 * Only considers critical/major severity in the last 7 days.
 */
export async function checkPredictiveWarning(vendorId: string): Promise<string | null> {
  const db = getDbClient();
  const { rows } = await db.query(
    `SELECT COUNT(*) as incident_count,
            AVG(duration_minutes) as avg_duration
     FROM incidents
     WHERE vendor_id = $1
       AND started_at >= CURRENT_DATE - INTERVAL '7 days'
       AND severity IN ('critical', 'major')`,
    [vendorId]
  );

  const count = parseInt(rows[0]?.incident_count ?? '0', 10);
  if (count >= 2) {
    const avgDur = rows[0]?.avg_duration ? Math.round(Number(rows[0].avg_duration)) : 0;
    return `⚠ ${vendorId} has had ${count} significant incidents in the last 7 days (avg duration: ${avgDur} min). Historical pattern suggests elevated risk.`;
  }
  return null;
}
