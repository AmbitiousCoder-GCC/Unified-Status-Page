import { expect, test, describe } from 'vitest';
import { StatuspageParser } from '../statuspage';

describe('StatuspageParser', () => {
  const parser = new StatuspageParser('github', 'GitHub');

  test('validates valid input', () => {
    expect(parser.validateInput({ page: {} })).toBe(true);
    expect(parser.validateInput({ status: {} })).toBe(true);
    expect(parser.validateInput(null)).toBe(false);
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
});
