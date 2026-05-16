import { expect, test, describe, vi, beforeEach } from 'vitest';
import { MicrosoftFabricAdapter } from '../../vendors/microsoft-fabric';

describe('Microsoft Fabric Adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  test('fetchStatus returns OPERATIONAL when Good is present', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><h1>Good</h1><p>Status is currently Good.</p></body></html>')
    });

    const status = await MicrosoftFabricAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL');
    expect(status.description).toBe('All systems operational');
  });

  test('fetchStatus returns DEGRADED when Service Outage is present', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><h1>Service Outage</h1><p>We are experiencing issues.</p></body></html>')
    });

    const status = await MicrosoftFabricAdapter.fetchStatus();
    expect(status.status).toBe('DEGRADED');
    expect(status.description).toBe('Potential service issues reported');
  });

  test('fetchStatus handles network errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const status = await MicrosoftFabricAdapter.fetchStatus();
    expect(status.status).toBe('OPERATIONAL'); // Fallback
    expect(status.description).toContain('Status page currently unreachable');
  });
});
