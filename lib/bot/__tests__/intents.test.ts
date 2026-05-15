import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseAlertIntent, performRootCauseAnalysis } from '../intents';

// Mock the DB client for checkPredictiveWarning
vi.mock('@/lib/db/client', () => ({
  getDbClient: () => ({
    query: vi.fn().mockResolvedValue({ rows: [{ incident_count: '3', avg_duration: '45' }] })
  })
}));

describe('parseAlertIntent', () => {
  test('extracts vendor and threshold from "alert me if github is down for 10 minutes"', () => {
    const result = parseAlertIntent('alert me if github is down for 10 minutes');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('create_alert');
    expect(result!.vendorId).toBe('github');
    expect(result!.thresholdMinutes).toBe(10);
  });

  test('extracts vendor by name "Alert me when GitLab is down for 5 min"', () => {
    const result = parseAlertIntent('Alert me when GitLab is down for 5 min');
    expect(result).not.toBeNull();
    expect(result!.vendorId).toBe('gitlab');
    expect(result!.thresholdMinutes).toBe(5);
  });

  test('defaults threshold to 5 when not specified', () => {
    const result = parseAlertIntent('Notify me if cloudflare goes down');
    expect(result).not.toBeNull();
    expect(result!.vendorId).toBe('cloudflare');
    expect(result!.thresholdMinutes).toBe(5);
  });

  test('returns null when no alert-related keyword is found', () => {
    const result = parseAlertIntent('What is the status of GitHub?');
    expect(result).toBeNull();
  });

  test('returns null when alert keyword present but no vendor match', () => {
    const result = parseAlertIntent('Alert me if unicorn-service goes down');
    expect(result).toBeNull();
  });
});

describe('performRootCauseAnalysis', () => {
  test('identifies shared dependency when 2+ vendors share one', async () => {
    // github depends on ['fastly', 'aws'], mongodb depends on ['aws', 'gcp']
    const result = await performRootCauseAnalysis(['github', 'mongodb']);
    expect(result).not.toBeNull();
    expect(result).toContain('aws');
    expect(result).toContain('github');
    expect(result).toContain('mongodb');
  });

  test('returns null when fewer than 2 vendors are degraded', async () => {
    const result = await performRootCauseAnalysis(['github']);
    expect(result).toBeNull();
  });

  test('returns null when degraded vendors share no dependencies', async () => {
    // cloudflare has [] deps, auth0 has ['aws']
    const result = await performRootCauseAnalysis(['cloudflare', 'auth0']);
    expect(result).toBeNull();
  });
});

describe('checkPredictiveWarning', () => {
  test('returns warning when incident count >= 2', async () => {
    // The mock returns incident_count: 3, avg_duration: 45
    const { checkPredictiveWarning } = await import('../intents');
    const result = await checkPredictiveWarning('github');
    expect(result).not.toBeNull();
    expect(result).toContain('github');
    expect(result).toContain('3');
    expect(result).toContain('45');
  });
});
