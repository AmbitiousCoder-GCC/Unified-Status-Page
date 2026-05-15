import { expect, test, describe } from 'vitest';
import { GcpParser } from '../gcp';

describe('GcpParser', () => {
  const parser = new GcpParser('gcp', 'Google Cloud');

  test('validates array input', () => {
    expect(parser.validateInput([])).toBe(true);
    expect(parser.validateInput({})).toBe(false);
    expect(parser.validateInput(null)).toBe(false);
    expect(parser.validateInput('string')).toBe(false);
  });

  test('returns operational when no incidents', () => {
    const result = parser.parse([]);
    expect(result.overallStatus).toBe('operational');
    expect(result.statusDescription).toBe('All Systems Operational');
    expect(result.activeIncidents).toHaveLength(0);
    expect(result.pastIncidents).toHaveLength(0);
  });

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
    expect(result.activeIncidents[0].severity).toBe('major');
  });

  test('maps medium severity to minor', () => {
    const now = new Date();
    const mockData = [{
      id: '3',
      external_desc: 'Minor Issue',
      severity: 'medium',
      begin: new Date(now.getTime() - 1000).toISOString(),
      service_name: 'BigQuery'
    }];
    const result = parser.parse(mockData);
    expect(result.activeIncidents[0].severity).toBe('minor');
  });

  test('returns fallback for invalid input', () => {
    const result = parser.parse({});
    expect(result.overallStatus).toBe('unknown');
    expect(result.statusDescription).toBe('Failed to parse data');
  });

  test('filters old incidents out of past list', () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const mockData = [{
      id: '4',
      external_desc: 'Old Incident',
      severity: 'low',
      begin: oldDate.toISOString(),
      end: new Date(oldDate.getTime() + 3600000).toISOString(),
      service_name: 'Cloud Run'
    }];
    const result = parser.parse(mockData);
    expect(result.pastIncidents).toHaveLength(0);
  });
});
