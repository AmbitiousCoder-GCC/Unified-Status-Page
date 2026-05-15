import { sql, createPool, VercelPool } from '@vercel/postgres';

let client: VercelPool | null = null;

export function getDbClient() {
  if (client) return client;

  const connectionString = process.env.POSTGRES_URL || 
                          process.env.DATABASE_URL || 
                          process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    console.warn("No postgres connection string found in environment variables.");
  }

  client = createPool({
    connectionString,
  });
  
  return client;
}

export { sql };
