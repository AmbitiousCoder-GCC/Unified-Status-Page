require('dotenv').config();
const { createPool } = require('@vercel/postgres');
const p = createPool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const tables = ['vendors', 'vendor_status', 'incidents'];
  for (const table of tables) {
    const { rows } = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n--- ${table} ---`);
    rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  }
  await p.end();
}
main().catch(e => { console.error(e); process.exit(1); });
