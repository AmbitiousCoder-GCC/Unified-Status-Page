require('dotenv').config();
const { createPool } = require('@vercel/postgres');
const p = createPool({ connectionString: process.env.POSTGRES_URL });

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

async function main() {
  try {
    const { rows } = await p.query(AGGREGATE_QUERY);
    console.log(`Success! Found ${rows.length} rows.`);
    console.log('First row sample:', JSON.stringify(rows[0], null, 2).substring(0, 500));
  } catch (e) {
    console.error('QUERY FAILED:', e.message);
  }
  await p.end();
}
main();
