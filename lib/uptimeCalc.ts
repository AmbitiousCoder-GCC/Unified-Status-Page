import { DayUptime, Incident } from "@/types/status";

export function calculateAverageUptime(days: DayUptime[]): number {
  if (!days || days.length === 0) return 100;
  const sum = days.reduce((acc, day) => acc + day.uptimePct, 0);
  return Number((sum / days.length).toFixed(4));
}

// Fallback for calculating uptime from incidents
export function calculateUptimeFromIncidents(incidents: Incident[], days = 30): number {
  if (!incidents || incidents.length === 0) return 100;
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  let totalDowntimeSeconds = 0;
  
  incidents.forEach(inc => {
    if (!inc.startedAt) return;
    
    const start = new Date(inc.startedAt);
    if (isNaN(start.getTime())) return;

    const end = inc.resolvedAt ? new Date(inc.resolvedAt) : now;
    if (isNaN(end.getTime())) return;
    
    // Only count downtime within the last 30 days
    const effectiveStart = start < thirtyDaysAgo ? thirtyDaysAgo : start;
    const effectiveEnd = end > now ? now : end;

    if (effectiveEnd > effectiveStart) {
      const duration = (effectiveEnd.getTime() - effectiveStart.getTime()) / 1000;
      if (inc.severity === "critical") {
        totalDowntimeSeconds += duration;
      } else if (inc.severity === "major") {
        totalDowntimeSeconds += duration * 0.5; // Partial outages count as 50% downtime
      } else if (inc.severity === "minor") {
        totalDowntimeSeconds += duration * 0.1; // Degraded counts as 10% downtime
      }
    }
  });

  const totalPeriodSeconds = days * 24 * 60 * 60;
  const uptime = ((totalPeriodSeconds - totalDowntimeSeconds) / totalPeriodSeconds) * 100;
  
  return Math.max(0, Math.min(100, Number(uptime.toFixed(4))));
}

export function generateMockUptimeHistory(uptime: number): DayUptime[] {
  const history: DayUptime[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Add some random noise for visual variety
    const noise = (Math.random() - 0.5) * 0.1;
    history.push({
      date: d.toISOString().split('T')[0],
      uptimePct: Math.min(100, Math.max(0, uptime + noise))
    });
  }
  return history;
}
