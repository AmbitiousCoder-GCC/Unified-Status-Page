import { DayUptime, Incident } from "@/types/status";

export function calculateAverageUptime(days: DayUptime[]): number {
  if (!days || days.length === 0) return 100;
  const sum = days.reduce((acc, day) => acc + day.uptimePct, 0);
  return Number((sum / days.length).toFixed(4));
}

// Fallback for calculating uptime from incidents
export function calculateUptimeFromIncidents(incidents: Incident[], days = 15): number {
  if (!incidents || incidents.length === 0) return 100;
  
  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  let totalDowntimeSeconds = 0;
  
  incidents.forEach(inc => {
    if (!inc.startedAt) return;
    
    const start = new Date(inc.startedAt);
    if (isNaN(start.getTime())) return;

    const end = inc.resolvedAt ? new Date(inc.resolvedAt) : now;
    if (isNaN(end.getTime())) return;
    
    // Only count downtime within the last 15 days
    const effectiveStart = start < fifteenDaysAgo ? fifteenDaysAgo : start;
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
  const phase = Math.random() * Math.PI * 2; // Unique wave offset per vendor
  
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    
    let value = uptime;
    if (uptime >= 99) {
      // Create a smooth sine-wave-like fluctuation for "healthy" vendors
      // Fluctuates smoothly to simulate realistic micro-variance
      const wave = Math.sin((i / 1.5) + phase);
      value = 99.9 + (wave * 0.1); 
    } else {
      // For actual outages, add realistic noise
      const noise = (Math.random() - 0.5) * 1.5;
      value = uptime + noise;
    }
    
    history.push({
      date: d.toISOString().split('T')[0],
      uptimePct: Math.min(100, Math.max(0, value))
    });
  }
  return history;
}
