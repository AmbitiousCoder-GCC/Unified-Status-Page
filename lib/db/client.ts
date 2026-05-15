import { sql, createPool, VercelPool } from '@vercel/postgres';

let client: VercelPool | null = null;

export function getDbClient() {
  if (!client) {
    client = createPool({
      connectionString: process.env.POSTGRES_URL,
    });
  }
  return client;
}

export { sql };
