import { expect, test, describe } from 'vitest';
import { GcpParser } from '../gcp';

describe('GcpParser', () => {
  const parser = new GcpParser('gcp', 'Google Cloud');

  test('parses active and resolved incidents', () => {
    const now = new Date();
    const mockData = [
      {
        id: '1',
        external_desc: 'Active Incident',
        severity: 'high',
        begin: new Date(now.getTime() - 1000).toISOString(),
        service_name: 'Compute Engine'
      },
      {
        id: '2',
        external_desc: 'Resolved Incident',
        severity: 'medium',
        begin: new Date(now.getTime() - 100000).toISOString(),
        end: new Date(now.getTime() - 50000).toISOString(),
        service_name: 'Cloud Storage'
      }
    ];

    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('partial_outage');
    expect(result.activeIncidents).toHaveLength(1);
    expect(result.pastIncidents).toHaveLength(1);
    expect(result.activeIncidents[0].title).toBe('Active Incident');
  });
});
