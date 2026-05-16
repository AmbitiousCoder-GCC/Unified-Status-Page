import { expect, test, describe, vi, beforeEach } from 'vitest';
import { GitHubAdapter } from '../github';
import { MongoDBAdapter } from '../mongodb';
import { CloudflareAdapter } from '../cloudflare';
import { SailPointAdapter } from '../sailpoint';
import { SnowflakeAdapter } from '../snowflake';

describe('Vendor Adapters', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  const mockStatuspageResponse = {
    status: { indicator: 'none', description: 'All Systems Operational' },
    incidents: []
  };

  test('GitHubAdapter parses summary correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatuspageResponse)
    });

    const status = await GitHubAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
    expect(status.vendor_id).toBe(GitHubAdapter.id);
  });

  test('MongoDBAdapter parses summary correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatuspageResponse)
    });

    const status = await MongoDBAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
    expect(status.vendor_id).toBe(MongoDBAdapter.id);
  });

  test('CloudflareAdapter parses summary correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatuspageResponse)
    });

    const status = await CloudflareAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
    expect(status.vendor_id).toBe(CloudflareAdapter.id);
  });

  test('SailPointAdapter parses summary correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatuspageResponse)
    });

    const status = await SailPointAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
  });

  test('SnowflakeAdapter parses summary correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatuspageResponse)
    });

    const status = await SnowflakeAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
  });
  
  test('Adapters handle 404 errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404
    });

    const status = await GitHubAdapter.fetchStatus();
    expect(status.description).toContain('Failed to fetch status');
  });
});
