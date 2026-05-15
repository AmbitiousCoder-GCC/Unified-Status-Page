import { expect, test, describe, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db/client', () => ({
  getDbClient: () => ({
    query: vi.fn().mockResolvedValue({ rows: [] })
  })
}));

vi.mock('@/app/api/rate-limit', () => ({
  aggregateRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 })
}));

describe('Aggregate API Route', () => {
  test('returns 200 and handles empty DB fallback', async () => {
    const req = new NextRequest('http://localhost/api/aggregate');
    const response = await GET(req);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
