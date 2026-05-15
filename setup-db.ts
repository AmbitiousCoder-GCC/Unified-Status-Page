import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getDbClient } from './lib/db/client';
import { seedVendors } from './lib/db/seed';

config({ path: resolve(__dirname, '.env') });

async function setup() {
  console.log('Connecting to database...');
  const db = getDbClient();
  
  try {
    console.log('Applying schema...');
    const schemaSql = readFileSync(resolve(__dirname, 'lib/db/schema.sql'), 'utf-8');
    
    // vercel postgres pool query runs a single statement at a time sometimes, 
    // but often handles full SQL blocks.
    await db.query(schemaSql);
    console.log('Schema applied successfully.');

    await seedVendors();
    
    console.log('Database setup complete.');
  } catch (error) {
    console.error('Failed during setup:', error);
  } finally {
    process.exit(0);
  }
}

setup();
