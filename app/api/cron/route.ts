import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db/client';
import { getParser } from '@/lib/parsers';
import pLimit from 'p-limit';
import { cronRateLimit, checkRateLimit } from '@/app/api/rate-limit';

export const dynamic = 'force-dynamic';

async function fetchWithRetry(url: string, isScrape: boolean, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, { 
        signal: controller.signal,
        headers: isScrape ? {
          'User-Agent': 'Mozilla/5.0 (compatible; NexusStatusBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        } : {
          'Accept': 'application/json, application/xml, text/plain, */*',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      if (isScrape || url.endsWith('.xml') || url.includes('feed') || url.includes('status.microsoft')) {
        return await res.text();
      }
      return await res.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); // Exponential backoff
    }
  }
}

export async function GET(req: Request) {
  // Verify Vercel Cron Auth
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rate Limiting
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { success, reset } = await checkRateLimit(cronRateLimit, ip);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() }
    });
  }

  const startTime = Date.now();
  const db = getDbClient();
  let processed = 0;
  let errorsCount = 0;

  try {
    const { rows: vendors } = await db.query('SELECT * FROM vendors');
    const limit = pLimit(4);

    await Promise.all(vendors.map(vendor => limit(async () => {
      let data: any = null;
      let errorStr: string | null = null;
      const fetchStart = Date.now();
      
      try {
        const isScrape = vendor.parser === 'auth0_scrape';
        data = await fetchWithRetry(vendor.api_url, isScrape);
        
        const parser = getParser(vendor.id, vendor.name, vendor.parser);
        const parsed = parser.parse(data);
        
        const responseTime = Date.now() - fetchStart;

        // Write status_checks
        await db.query(
          `INSERT INTO status_checks (vendor_id, status, response_time_ms, raw_data) 
           VALUES ($1, $2, $3, $4)`,
          [vendor.id, parsed.overallStatus, responseTime, JSON.stringify(data)]
        );

        // Upsert incidents
        for (const inc of parsed.activeIncidents.concat(parsed.pastIncidents)) {
          await db.query(
            `INSERT INTO incidents (id, vendor_id, title, severity, status, started_at, resolved_at, affected_components, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               severity = EXCLUDED.severity,
               status = EXCLUDED.status,
               resolved_at = EXCLUDED.resolved_at,
               affected_components = EXCLUDED.affected_components,
               raw_data = EXCLUDED.raw_data`,
            [inc.id, vendor.id, inc.title, inc.severity, inc.status, inc.startedAt, inc.resolvedAt, inc.affectedComponents, JSON.stringify(inc.updates)]
          );
        }

        // Calculate and upsert uptime_daily
        const today = new Date().toISOString().split('T')[0];
        const isUp = parsed.overallStatus === 'operational' ? 1 : 0;
        
        await db.query(
          `INSERT INTO uptime_daily (vendor_id, date, total_checks, failed_checks)
           VALUES ($1, $2, 1, $3)
           ON CONFLICT (vendor_id, date) DO UPDATE SET
             total_checks = uptime_daily.total_checks + 1,
             failed_checks = uptime_daily.failed_checks + EXCLUDED.failed_checks`,
          [vendor.id, today, isUp ? 0 : 1]
        );
        
        await db.query(
          `UPDATE uptime_daily 
           SET uptime_pct = ((total_checks - failed_checks)::numeric / total_checks) * 100 
           WHERE vendor_id = $1 AND date = $2`,
          [vendor.id, today]
        );

        // Alert rules check
        const { rows: alerts } = await db.query(
          `SELECT * FROM alert_rules WHERE vendor_id = $1 AND is_active = true`,
          [vendor.id]
        );
        
        for (const alert of alerts) {
          if (alert.condition_type === 'outage' && parsed.overallStatus !== 'operational') {
            console.log(`[ALERT TRIGGERED] Vendor ${vendor.name} is ${parsed.overallStatus}. Rule ID: ${alert.id}`);
            // Logic to send webhook would go here
          }
        }

        processed++;
      } catch (err) {
        errorsCount++;
        errorStr = err instanceof Error ? err.message : String(err);
        console.error(`Error processing vendor ${vendor.name}:`, err);
        
        await db.query(
          `INSERT INTO status_checks (vendor_id, status, response_time_ms, raw_data) 
           VALUES ($1, $2, $3, $4)`,
          [vendor.id, 'unknown', Date.now() - fetchStart, JSON.stringify({ error: errorStr })]
        );
      }
    })));

    const duration_ms = Date.now() - startTime;
    return NextResponse.json({ processed, errors: errorsCount, duration_ms });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
