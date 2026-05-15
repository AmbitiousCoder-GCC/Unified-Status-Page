import { ParseResult, StatusParser } from './types';
import { ComponentStatus, StatusLevel } from '@/types/status';

export async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.text();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); // 1s, 2s, 4s
    }
  }
  throw new Error('Max retries exceeded');
}

export class Auth0ScrapeParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    return typeof data === 'string' && data.toLowerCase().includes('<html');
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const html = data as string;
    const lowerHtml = html.toLowerCase();
    
    let overallStatus: StatusLevel = "unknown";
    let statusDescription = "Unable to determine status";

    if (lowerHtml.includes("all regions operational") || lowerHtml.includes("all systems operational")) {
      overallStatus = "operational";
      statusDescription = "All Systems Operational";
    } else if (lowerHtml.includes("major outage") || lowerHtml.includes("major disruption")) {
      overallStatus = "major_outage";
      statusDescription = "Major Outage";
    } else if (lowerHtml.includes("partial outage") || lowerHtml.includes("partial disruption")) {
      overallStatus = "partial_outage";
      statusDescription = "Partial Outage";
    } else if (lowerHtml.includes("degraded") || lowerHtml.includes("performance issues")) {
      overallStatus = "degraded";
      statusDescription = "Degraded Performance";
    } else if (lowerHtml.includes("maintenance")) {
      overallStatus = "maintenance";
      statusDescription = "Under Maintenance";
    } else if (lowerHtml.includes("operational")) {
      overallStatus = "operational";
      statusDescription = "All Systems Operational";
    }

    const components: ComponentStatus[] = [];
    const regionPattern = /([A-Z]{2}-\d+)\s*[:\|]?\s*(All Systems Operational|Operational|Degraded|Partial Outage|Major Outage)/gi;
    let match;
    while ((match = regionPattern.exec(html)) !== null) {
      const regionName = match[1];
      const regionStatusText = match[2].toLowerCase();
      let regionStatus: StatusLevel = "operational";
      if (regionStatusText.includes("major")) regionStatus = "major_outage";
      else if (regionStatusText.includes("partial")) regionStatus = "partial_outage";
      else if (regionStatusText.includes("degraded")) regionStatus = "degraded";
      
      components.push({
        id: regionName,
        name: regionName,
        status: regionStatus,
        uptimePct: 100
      });
    }

    return {
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription,
      activeIncidents: [],
      pastIncidents: [],
      scheduledMaintenances: [],
      components: components.slice(0, 10)
    };
  }

  private fallbackResult(): ParseResult {
    return {
      fetchedAt: new Date().toISOString(),
      overallStatus: 'unknown',
      statusDescription: 'Failed to parse HTML data',
      activeIncidents: [],
      pastIncidents: [],
      scheduledMaintenances: [],
      components: []
    };
  }
}
