import { ParseResult, StatusParser } from './types';
import { Incident, StatusLevel } from '@/types/status';

export class GcpParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    return Array.isArray(data);
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const incidentsData = data as any[];
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    
    const recentIncidents = incidentsData.filter((inc: any) => new Date(inc.begin) >= fifteenDaysAgo);
    const activeIncidentsRaw = incidentsData.filter((inc: any) => !inc.end || new Date(inc.end) > now);
    
    const overallStatus: StatusLevel = activeIncidentsRaw.length > 0 ? "partial_outage" : "operational";
    const statusDescription = activeIncidentsRaw.length > 0 ? "Service Disruption" : "All Systems Operational";
    
    const activeIncidents: Incident[] = activeIncidentsRaw.map((inc: any) => ({
      id: inc.id,
      title: inc.external_desc,
      severity: inc.severity === "high" ? "major" : "minor",
      status: "investigating",
      startedAt: inc.begin,
      affectedComponents: [inc.service_name],
      updates: inc.updates?.map((u: any) => ({
        timestamp: u.created,
        message: u.text,
        status: "update"
      })) || [],
      url: inc.uri
    }));

    const pastIncidentsRaw = recentIncidents.filter((inc: any) => inc.end && new Date(inc.end) <= now);
    const pastIncidents: Incident[] = pastIncidentsRaw.map((inc: any) => ({
      id: inc.id,
      title: inc.external_desc,
      severity: (inc.severity === "high" ? "major" : "minor") as "major" | "minor",
      status: "resolved" as const,
      startedAt: inc.begin,
      resolvedAt: inc.end,
      affectedComponents: [inc.service_name],
      updates: [],
      url: inc.uri
    })).slice(0, 5);

    return {
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription,
      activeIncidents,
      pastIncidents,
      scheduledMaintenances: [],
      components: []
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
