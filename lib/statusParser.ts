import { VendorStatus, StatusLevel, Incident, ComponentStatus } from "@/types/status";
import { XMLParser } from "fast-xml-parser";
import { generateMockUptimeHistory, calculateUptimeFromIncidents } from "./uptimeCalc";

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

export const parseStatuspage = (id: string, data: any): VendorStatus => {
  const overallStatus = mapStatuspageIndicator(data.status?.indicator || "none");
  const statusDescription = data.status?.description || "All Systems Operational";
  
  const components: ComponentStatus[] = (data.components || [])
    .filter((c: any) => !c.group_id) // Skip groups for simplicity
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      status: mapStatuspageIndicator(c.status === "operational" ? "none" : 
              c.status === "degraded_performance" ? "minor" : 
              c.status === "partial_outage" ? "major" : 
              c.status === "major_outage" ? "critical" : "none"),
      uptimePct: 100 // Default, would come from uptime_30d endpoint if merged
    })).slice(0, 10);

  const activeIncidents: Incident[] = (data.incidents || []).map((inc: any) => ({
    id: inc.id,
    title: inc.name,
    severity: inc.impact === "critical" ? "critical" : inc.impact === "major" ? "major" : "minor",
    status: inc.status,
    startedAt: inc.started_at,
    resolvedAt: inc.resolved_at,
    affectedComponents: inc.components?.map((c: any) => c.name) || [],
    updates: inc.incident_updates?.map((u: any) => ({
      timestamp: u.created_at,
      message: u.body,
      status: u.status
    })) || [],
    url: inc.shortlink
  }));

  const scheduledMaintenances: Incident[] = (data.scheduled_maintenances || []).map((inc: any) => ({
    id: inc.id,
    title: inc.name,
    severity: "maintenance",
    status: inc.status,
    startedAt: inc.scheduled_for,
    resolvedAt: inc.scheduled_until,
    affectedComponents: inc.components?.map((c: any) => c.name) || [],
    updates: inc.incident_updates?.map((u: any) => ({
      timestamp: u.created_at,
      message: u.body,
      status: u.status
    })) || [],
    url: inc.shortlink
  }));

  // Fallback uptime if uptime_15d is not injected before this function
  const uptimePct15d = data.uptimePct15d !== undefined 
    ? data.uptimePct15d 
    : calculateUptimeFromIncidents(activeIncidents, 15);
    
  const uptimeHistory = data.uptimeHistory || generateMockUptimeHistory(uptimePct15d);

  return {
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription,
    uptimePct15d,
    uptimeHistory,
    activeIncidents,
    scheduledMaintenances,
    components
  };
};

export const parseGcp = (id: string, data: any[]): VendorStatus => {
  // GCP returns an array of incidents
  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  
  const recentIncidents = data.filter((inc: any) => new Date(inc.begin) >= fifteenDaysAgo);
  const activeIncidentsRaw = data.filter((inc: any) => !inc.end || new Date(inc.end) > now);
  
  const overallStatus: StatusLevel = activeIncidentsRaw.length > 0 ? "partial_outage" : "operational";
  const statusDescription = activeIncidentsRaw.length > 0 ? "Service Disruption" : "All Systems Operational";
  
  const activeIncidents: Incident[] = activeIncidentsRaw.map((inc: any) => ({
    id: inc.id,
    title: inc.external_desc,
    severity: inc.severity === "high" ? "major" : inc.severity === "medium" ? "minor" : "minor",
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

  const uptimePct15d = calculateUptimeFromIncidents(
    recentIncidents.map((inc: any) => ({
      ...inc,
      startedAt: inc.begin,
      resolvedAt: inc.end,
      severity: inc.severity === "high" ? "major" : "minor"
    })), 
    15
  );

  return {
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription,
    uptimePct15d,
    uptimeHistory: generateMockUptimeHistory(uptimePct15d),
    activeIncidents,
    scheduledMaintenances: [],
    components: []
  };
};

export const parseAzureRss = (id: string, xmlString: string): VendorStatus => {
  const parser = new XMLParser();
  const result = parser.parse(xmlString);
  
  const items = result?.rss?.channel?.item || [];
  const itemsArray = Array.isArray(items) ? items : [items];
  
  const now = new Date();
  const activeIncidents: Incident[] = [];
  
  // A naive approach: if the latest item does not say "Resolved" or "Mitigated", consider it active.
  itemsArray.slice(0, 5).forEach((item: any) => {
    const title = item.title?.toLowerCase() || "";
    if (!title.includes("resolved") && !title.includes("mitigated") && !title.includes("information")) {
      activeIncidents.push({
        id: item.guid,
        title: item.title,
        severity: "major",
        status: "investigating",
        startedAt: item.pubDate,
        affectedComponents: [],
        updates: [{
          timestamp: item.pubDate,
          message: item.description,
          status: "investigating"
        }],
        url: item.link
      });
    }
  });

  const overallStatus = activeIncidents.length > 0 ? "partial_outage" : "operational";
  
  return {
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription: activeIncidents.length > 0 ? "Azure Services Degraded" : "All Systems Operational",
    uptimePct15d: 99.99, // Best effort estimation without deep RSS parsing
    uptimeHistory: generateMockUptimeHistory(99.99),
    activeIncidents,
    scheduledMaintenances: [],
    components: []
  };
};
