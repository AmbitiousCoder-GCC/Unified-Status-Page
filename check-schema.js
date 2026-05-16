require('dotenv').config();
const { createPool } = require('@vercel/postgres');
const p = createPool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const { rows } = await p.query('SELECT id, name FROM vendors ORDER BY name ASC');
  console.log(JSON.stringify(rows, null, 2));
  await p.end();
}
main().catch(e => { console.error(e); process.exit(1); });
