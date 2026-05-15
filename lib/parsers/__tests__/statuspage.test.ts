import { expect, test, describe } from 'vitest';
import { StatuspageParser } from '../statuspage';

describe('StatuspageParser', () => {
  const parser = new StatuspageParser('github', 'GitHub');

  test('validates valid input', () => {
    expect(parser.validateInput({ page: {} })).toBe(true);
    expect(parser.validateInput({ status: {} })).toBe(true);
    expect(parser.validateInput(null)).toBe(false);
    expect(parser.validateInput(undefined)).toBe(false);
    expect(parser.validateInput('string')).toBe(false);
  });

  test('parses operational status correctly', () => {
    const mockData = {
      status: { indicator: 'none', description: 'All Systems Operational' },
      components: [],
      incidents: []
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('operational');
    expect(result.statusDescription).toBe('All Systems Operational');
    expect(result.activeIncidents).toHaveLength(0);
  });

  test('parses active incidents correctly', () => {
    const mockData = {
      status: { indicator: 'minor' },
      incidents: [
        {
          id: '123',
          name: 'Minor issue',
          impact: 'minor',
          status: 'investigating',
          started_at: '2023-01-01T00:00:00Z'
        }
      ]
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('degraded');
    expect(result.activeIncidents).toHaveLength(1);
    expect(result.activeIncidents[0].status).toBe('investigating');
  });

  test('maps major indicator to partial_outage', () => {
    const mockData = {
      status: { indicator: 'major' },
      incidents: []
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('partial_outage');
  });

  test('maps critical indicator to major_outage', () => {
    const mockData = {
      status: { indicator: 'critical' },
      incidents: []
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('major_outage');
  });

  test('maps maintenance indicator', () => {
    const mockData = {
      status: { indicator: 'maintenance' },
      incidents: []
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('maintenance');
  });

  test('maps unknown indicator', () => {
    const mockData = {
      status: { indicator: 'weird_value' },
      incidents: []
    };
    const result = parser.parse(mockData);
    expect(result.overallStatus).toBe('unknown');
  });

  test('separates resolved from active incidents', () => {
    const mockData = {
      status: { indicator: 'none' },
      incidents: [
        { id: '1', name: 'Active', impact: 'minor', status: 'investigating', started_at: '2023-01-01T00:00:00Z' },
        { id: '2', name: 'Resolved', impact: 'major', status: 'resolved', started_at: '2023-01-01T00:00:00Z', resolved_at: '2023-01-02T00:00:00Z' },
        { id: '3', name: 'Postmortem', impact: 'critical', status: 'postmortem', started_at: '2023-01-01T00:00:00Z' }
      ]
    };
    const result = parser.parse(mockData);
    expect(result.activeIncidents).toHaveLength(1);
    expect(result.pastIncidents).toHaveLength(2);
  });

  test('parses components with status mapping', () => {
    const mockData = {
      status: { indicator: 'none' },
      incidents: [],
      components: [
        { id: 'c1', name: 'API', status: 'operational' },
        { id: 'c2', name: 'Web', status: 'degraded_performance' },
        { id: 'c3', name: 'Git Ops', status: 'partial_outage' },
        { id: 'c4', name: 'Actions', status: 'major_outage' }
      ]
    };
    const result = parser.parse(mockData);
    expect(result.components).toHaveLength(4);
    expect(result.components[0].status).toBe('operational');
    expect(result.components[1].status).toBe('degraded');
    expect(result.components[2].status).toBe('partial_outage');
    expect(result.components[3].status).toBe('major_outage');
  });

  test('parses scheduled maintenances', () => {
    const mockData = {
      status: { indicator: 'none' },
      incidents: [],
      scheduled_maintenances: [
        { id: 'm1', name: 'DB Upgrade', status: 'scheduled', scheduled_for: '2026-06-01T00:00:00Z', scheduled_until: '2026-06-01T04:00:00Z' }
      ]
    };
    const result = parser.parse(mockData);
    expect(result.scheduledMaintenances).toHaveLength(1);
    expect(result.scheduledMaintenances[0].severity).toBe('maintenance');
  });

  test('returns fallback for invalid input', () => {
    const result = parser.parse(null);
    expect(result.overallStatus).toBe('unknown');
    expect(result.statusDescription).toBe('Failed to parse data');
  });
});
