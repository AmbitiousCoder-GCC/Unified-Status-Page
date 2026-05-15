import { expect, test, describe } from 'vitest';
import { Auth0ScrapeParser } from '../auth0-scrape';

describe('Auth0ScrapeParser', () => {
  const parser = new Auth0ScrapeParser('auth0', 'Auth0');

  test('validates HTML input', () => {
    expect(parser.validateInput('<html><body></body></html>')).toBe(true);
    expect(parser.validateInput({})).toBe(false);
    expect(parser.validateInput(null)).toBe(false);
    expect(parser.validateInput(42)).toBe(false);
    expect(parser.validateInput('')).toBe(false);
  });

  test('extracts operational status', () => {
    const html = '<html><body>All regions operational</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('operational');
    expect(result.statusDescription).toBe('All Systems Operational');
  });

  test('extracts major outage status', () => {
    const html = '<html><body>Major outage detected in some regions</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('major_outage');
    expect(result.statusDescription).toBe('Major Outage');
  });

  test('extracts partial outage status', () => {
    const html = '<html><body>Partial outage in US regions</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('partial_outage');
    expect(result.statusDescription).toBe('Partial Outage');
  });

  test('extracts degraded status', () => {
    const html = '<html><body>Service is degraded in some areas</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('degraded');
    expect(result.statusDescription).toBe('Degraded Performance');
  });

  test('extracts maintenance status', () => {
    const html = '<html><body>Scheduled maintenance underway</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('maintenance');
    expect(result.statusDescription).toBe('Under Maintenance');
  });

  test('extracts generic operational status', () => {
    const html = '<html><body>Everything is operational today</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('operational');
  });

  test('returns unknown for unrecognized HTML', () => {
    const html = '<html><body>Something weird happened</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('unknown');
  });

  test('returns fallback for invalid input', () => {
    const result = parser.parse({ notHtml: true });
    expect(result.overallStatus).toBe('unknown');
    expect(result.statusDescription).toBe('Failed to parse HTML data');
  });

  test('extracts region components from HTML', () => {
    const html = '<html><body>All systems operational US-1: Operational EU-2: Degraded</body></html>';
    const result = parser.parse(html);
    expect(result.components.length).toBeGreaterThanOrEqual(1);
  });
});
