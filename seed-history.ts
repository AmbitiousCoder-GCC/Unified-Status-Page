import { config } from 'dotenv';
import { resolve } from 'path';
import { getDbClient } from './lib/db/client';

config({ path: resolve(__dirname, '.env') });

async function seedHistory() {
  const db = getDbClient();
  const today = new Date();
  
  const vendors = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'GitHub' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'MongoDB' },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Azure' },
    { id: '00000000-0000-4000-8000-000000000004', name: 'Google Cloud' },
    { id: '00000000-0000-4000-8000-000000000005', name: 'AWS' },
    { id: '00000000-0000-4000-8000-000000000006', name: 'Cloudflare' },
    { id: '00000000-0000-4000-8000-000000000007', name: 'GitLab' },
    { id: '00000000-0000-4000-8000-000000000008', name: 'Databricks' },
    { id: '00000000-0000-4000-8000-000000000009', name: 'Auth0' },
    { id: '00000000-0000-4000-8000-000000000010', name: 'Snowflake' },
    { id: '00000000-0000-4000-8000-000000000011', name: 'SailPoint' },
    { id: '00000000-0000-4000-8000-000000000012', name: 'Cycode' },
  ];

  console.log('Seeding 15-day historical uptime data...');

  try {
    for (const vendor of vendors) {
      for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        let uptime = 100.00;
        let failed = 0;
        let total = 144; // 1 check every 10 mins = 144 checks/day

        // Snowflake: Down for 14/15 days (days 1-14 ago)
        if (vendor.name === 'Snowflake' && i > 0) {
          uptime = 0.00;
          failed = 144;
        } 
        // Cloudflare: Degraded recently (last 3 days)
        else if (vendor.name === 'Cloudflare' && i < 3) {
          uptime = 85.00;
          failed = 22;
        }
        // General variety
        else if (Math.random() > 0.9) {
          uptime = 99.30;
          failed = 1;
        }

        await db.query(`
          INSERT INTO uptime_daily (vendor_id, date, total_checks, failed_checks, uptime_pct)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (vendor_id, date) DO UPDATE SET
            uptime_pct = EXCLUDED.uptime_pct,
            total_checks = EXCLUDED.total_checks,
            failed_checks = EXCLUDED.failed_checks
        `, [vendor.id, dateStr, total, failed, uptime]);
      }
    }
    console.log('History seeding complete.');
  } catch (error) {
    console.error('Failed to seed history:', error);
  } finally {
    process.exit(0);
  }
}

seedHistory();
