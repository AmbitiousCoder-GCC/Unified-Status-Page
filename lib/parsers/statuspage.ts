import { ParseResult, StatusParser } from './types';
import { ComponentStatus, Incident, StatusLevel } from '@/types/status';

const stripHtml = (html: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
};

const mapStatuspageIndicator = (indicator: string): StatusLevel => {
  switch (indicator) {
    case "none": return "operational";
    case "minor": return "degraded";
    case "major": return "partial_outage";
    case "critical": return "major_outage";
    case "maintenance": return "maintenance";
    default: return "unknown";
  }
};

export class StatuspageParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const d = data as any;
    return d.page !== undefined || d.status !== undefined;
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const d = data as any;
    const overallStatus = mapStatuspageIndicator(d.status?.indicator || "none");
    const statusDescription = d.status?.description || "All Systems Operational";

    const components: ComponentStatus[] = (d.components || [])
      .filter((c: any) => !c.group_id)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        status: mapStatuspageIndicator(
          c.status === "operational" ? "none" : 
          c.status === "degraded_performance" ? "minor" : 
          c.status === "partial_outage" ? "major" : 
          c.status === "major_outage" ? "critical" : "none"
        ),
        uptimePct: 100 // Default, DB will handle real uptime
      })).slice(0, 10);

    const allIncidents = (d.incidents || []).map((inc: any) => ({
      id: inc.id,
      title: stripHtml(inc.name),
      severity: inc.impact === "critical" ? "critical" : inc.impact === "major" ? "major" : "minor",
      status: inc.status === "resolved" || inc.status === "postmortem" || inc.status === "completed" ? "resolved" : "investigating",
      startedAt: inc.started_at,
      resolvedAt: inc.resolved_at,
      affectedComponents: inc.components?.map((c: any) => c.name) || [],
      updates: inc.incident_updates?.map((u: any) => ({
        timestamp: u.created_at,
        message: stripHtml(u.body),
        status: u.status
      })) || [],
      url: inc.shortlink
    }));

    const activeIncidents = allIncidents.filter((inc: any) => inc.status !== "resolved");
    const pastIncidents = allIncidents.filter((inc: any) => inc.status === "resolved").slice(0, 5);

    const scheduledMaintenances: Incident[] = (d.scheduled_maintenances || []).map((inc: any) => ({
      id: inc.id,
      title: inc.name,
      severity: "maintenance",
      status: inc.status,
      startedAt: inc.scheduled_for,
      resolvedAt: inc.scheduled_until,
      affectedComponents: inc.components?.map((c: any) => c.name) || [],
      updates: inc.incident_updates?.map((u: any) => ({
        timestamp: u.created_at,
        message: stripHtml(u.body),
        status: u.status
      })) || [],
      url: inc.shortlink
    }));

    return {
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription,
      activeIncidents,
      pastIncidents,
      scheduledMaintenances,
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
