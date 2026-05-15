import { getDbClient, sql } from './client';
import { VENDORS } from '../vendors';

export async function seedVendors() {
  const db = getDbClient();
  
  console.log('Seeding vendors...');
  
  try {
    for (const vendor of VENDORS) {
      await db.query(
        `
        INSERT INTO vendors (id, name, status_url, api_url, logo_url, accent_color, description, parser)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status_url = EXCLUDED.status_url,
          api_url = EXCLUDED.api_url,
          logo_url = EXCLUDED.logo_url,
          accent_color = EXCLUDED.accent_color,
          description = EXCLUDED.description,
          parser = EXCLUDED.parser
        `,
        [
          vendor.id,
          vendor.name,
          vendor.statusUrl,
          vendor.apiUrl,
          vendor.logoUrl,
          vendor.accentColor,
          vendor.description,
          (vendor as any).parser || 'statuspage'
        ]
      );
    }
    console.log(`Successfully seeded ${VENDORS.length} vendors.`);
  } catch (error) {
    console.error('Error seeding vendors:', error);
    throw error;
  }
}
