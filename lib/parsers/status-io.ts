import { ParseResult, StatusParser } from './types';
import { ComponentStatus, StatusLevel } from '@/types/status';

export class StatusIoParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const d = data as any;
    return d.result !== undefined;
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const result = (data as any).result || {};
    const statusOverall = result.status_overall || {};
    
    const mapStatusIoStatus = (statusCode: number, statusText?: string): StatusLevel => {
      if (statusCode === 100) return "operational";
      if (statusCode >= 500) return "major_outage";
      if (statusCode >= 400) return "partial_outage";
      if (statusCode >= 300) return "degraded";
      if (statusText) {
        const lower = statusText.toLowerCase();
        if (lower.includes("disruption") || lower.includes("major")) return "major_outage";
        if (lower.includes("degraded")) return "degraded";
        if (lower.includes("partial")) return "partial_outage";
      }
      return "operational";
    };

    const overallStatus = mapStatusIoStatus(statusOverall.status_code || 100, statusOverall.status_text);
    
    const components: ComponentStatus[] = (result.status || []).map((c: any) => ({
      id: c.id || Math.random().toString(),
      name: c.name,
      status: mapStatusIoStatus(c.status_code),
      uptimePct: 100
    })).slice(0, 10);

    const allIncidents = (result.incidents || []).map((inc: any) => ({
      id: inc._id,
      title: inc.name,
      severity: "major" as const,
      status: inc.current_active ? "investigating" as const : "resolved" as const,
      startedAt: inc.datetime_open,
      affectedComponents: [],
      updates: [],
      url: ""
    }));
    
    const activeIncidents = allIncidents.filter((i: any) => i.status !== "resolved");
    const pastIncidents = allIncidents.filter((i: any) => i.status === "resolved").slice(0, 5);

    return {
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription: statusOverall.status_text || "All Systems Operational",
      activeIncidents,
      pastIncidents,
      scheduledMaintenances: [],
      components
    };
  }

  private fallbackResult(): ParseResult {
    return {
      fetchedAt: new Date().toISOString(),
      overallStatus: 'unknown',
      statusDescription: 'Failed to parse data',
      activeIncidents: [],
      pastIncidents: [],
      scheduledMaintenances: [],
      components: []
    };
  }
}
