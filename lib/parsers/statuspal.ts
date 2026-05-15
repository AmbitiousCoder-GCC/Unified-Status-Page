import { ParseResult, StatusParser } from './types';
import { ComponentStatus, Incident, StatusLevel } from '@/types/status';

export class StatuspalParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const d = data as any;
    return d.status_page !== undefined;
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const d = data as any;
    const statusPage = d.status_page || {};
    const services = d.services || [];
    const incidents = d.incidents || [];
    const maintenances = d.maintenances || [];

    const mapStatuspalType = (type: string | null): StatusLevel => {
      if (!type) return "operational";
      switch (type.toLowerCase()) {
        case "major": return "major_outage";
        case "minor": return "degraded";
        case "maintenance": return "maintenance";
        default: return "unknown";
      }
    };

    const overallStatus = mapStatuspalType(statusPage.current_incident_type);
    const statusDescription = overallStatus === "operational" 
      ? "All Systems Operational" 
      : `Service ${statusPage.current_incident_type || "issue"} detected`;

    const components: ComponentStatus[] = [];
    services.forEach((svc: any) => {
      if (svc.children && svc.children.length > 0) {
        svc.children.forEach((child: any) => {
          components.push({
            id: String(child.id),
            name: child.name,
            status: mapStatuspalType(child.current_incident_type),
            uptimePct: 100
          });
        });
      } else {
        components.push({
          id: String(svc.id),
          name: svc.name,
          status: mapStatuspalType(svc.current_incident_type),
          uptimePct: 100
        });
      }
    });

    const allIncidents = incidents.map((inc: any) => ({
      id: String(inc.id || Math.random()),
      title: inc.title || inc.name || "Incident",
      severity: inc.type === "major" ? "major" as const : "minor" as const,
      status: inc.resolved_at ? "resolved" as const : "investigating" as const,
      startedAt: inc.starts_at || inc.created_at || new Date().toISOString(),
      resolvedAt: inc.resolved_at,
      affectedComponents: (inc.services || []).map((s: any) => s.name || ""),
      updates: (inc.updates || []).map((u: any) => ({
        timestamp: u.created_at,
        message: u.description || u.message || "",
        status: u.status || "update"
      })),
      url: ""
    }));
    
    const activeIncidents = allIncidents.filter((i: any) => i.status !== "resolved");
    const pastIncidents = allIncidents.filter((i: any) => i.status === "resolved").slice(0, 5);

    const scheduledMaintenances: Incident[] = maintenances.map((m: any) => ({
      id: String(m.id || Math.random()),
      title: m.title || m.name || "Maintenance",
      severity: "maintenance" as const,
      status: "monitoring" as const,
      startedAt: m.starts_at || m.created_at || new Date().toISOString(),
      resolvedAt: m.ends_at,
      affectedComponents: (m.services || []).map((s: any) => s.name || ""),
      updates: [],
      url: ""
    }));

    return {
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription,
      activeIncidents,
      pastIncidents,
      scheduledMaintenances,
      components: components.slice(0, 10)
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
