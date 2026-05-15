/**
 * Uptime calculation using actual check counts, not daily averages.
 */
export function calculateUptimeFromChecks(totalChecks: number, failedChecks: number): number {
  if (totalChecks <= 0) return 100;
  return Number((((totalChecks - failedChecks) / totalChecks) * 100).toFixed(4));
}
