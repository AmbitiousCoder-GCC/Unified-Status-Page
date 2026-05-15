import { getDbClient } from '@/lib/db/client';
import { DEPENDENCIES } from '@/lib/dependencies';

export async function executeBotAction(actionData: any) {
  const db = getDbClient();
  let resultMessage = "";

  if (actionData.type === 'create_alert' && actionData.vendorId) {
    const threshold = actionData.thresholdMinutes || 0;
    try {
      await db.query(
        `INSERT INTO alert_rules (vendor_id, condition_type, threshold_minutes, webhook_url)
         VALUES ($1, 'outage', $2, 'console')`,
        [actionData.vendorId, threshold]
      );
      resultMessage = `✅ Alert rule created for ${actionData.vendorId} (threshold: ${threshold} min).`;
    } catch (e) {
      console.error("Failed to create alert:", e);
      resultMessage = `❌ Failed to create alert rule.`;
    }
  }

  return resultMessage;
}

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

export async function checkPredictiveWarning(vendorId: string): Promise<string | null> {
  const db = getDbClient();
  const { rows } = await db.query(
    `SELECT COUNT(*) as incident_count FROM incidents WHERE vendor_id = $1 AND started_at > NOW() - INTERVAL '7 days'`,
    [vendorId]
  );
  
  const count = parseInt(rows[0].incident_count, 10);
  if (count > 2) {
    return `Predictive Warning: ${vendorId} has had ${count} incidents in the last 7 days. Stability may be degraded.`;
  }
  return null;
}
