import { getDbClient, sql } from './client';
import { VENDORS } from '../vendors';

export async function seedVendors() {
  const db = getDbClient();
  
  console.log('Seeding vendors...');
  
  try {
    for (const vendor of Object.values(VENDORS)) {
      await db.query(
        `
        INSERT INTO vendors (id, name, status_page_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status_page_url = EXCLUDED.status_page_url
        `,
        [
          vendor.id,
          vendor.name,
          vendor.status_page_url || `https://status.${vendor.id}.com`
        ]
      );
    }
    console.log(`Successfully seeded ${Object.keys(VENDORS).length} vendors.`);
  } catch (error) {
    console.error('Error seeding vendors:', error);
    throw error;
  }
}
