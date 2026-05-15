import { expect, test, describe } from 'vitest';
import { Auth0ScrapeParser } from '../auth0-scrape';

describe('Auth0ScrapeParser', () => {
  const parser = new Auth0ScrapeParser('auth0', 'Auth0');

  test('validates HTML input', () => {
    expect(parser.validateInput('<html><body></body></html>')).toBe(true);
    expect(parser.validateInput({})).toBe(false);
  });

  test('extracts operational status', () => {
    const html = '<html><body>All regions operational</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('operational');
  });

  test('extracts outage status', () => {
    const html = '<html><body>Major outage detected in some regions</body></html>';
    const result = parser.parse(html);
    expect(result.overallStatus).toBe('major_outage');
  });
});
