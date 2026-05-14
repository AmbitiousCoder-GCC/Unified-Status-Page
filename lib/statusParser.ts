import { VendorStatus, StatusLevel, Incident, ComponentStatus } from "@/types/status";
import { XMLParser } from "fast-xml-parser";
import { generateMockUptimeHistory, calculateUptimeFromIncidents } from "./uptimeCalc";

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

  const allIncidents = (data.incidents || []).map((inc: any) => ({
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
    pastIncidents,
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
    pastIncidents,
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
  const pastIncidents: Incident[] = [];
  
  itemsArray.slice(0, 5).forEach((item: any) => {
    const title = item.title?.toLowerCase() || "";
    const isResolved = title.includes("resolved") || title.includes("mitigated");
    
    const inc = {
      id: item.guid,
      title: item.title,
      severity: "major" as const,
      status: isResolved ? "resolved" as const : "investigating" as const,
      startedAt: item.pubDate,
      affectedComponents: [],
      updates: [{
        timestamp: item.pubDate,
        message: item.description,
        status: "investigating"
      }],
      url: item.link
    };
    if (isResolved) {
      pastIncidents.push(inc);
    } else if (!title.includes("information")) {
      activeIncidents.push(inc);
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
    pastIncidents,
    scheduledMaintenances: [],
    components: []
  };
};
export const parseStatusIo = (id: string, data: any): VendorStatus => {
  const result = data.result || {};
  const statusOverall = result.status_overall || {};
  
  const mapStatusIoStatus = (statusCode: number, statusText?: string): StatusLevel => {
    // Status.io codes: 100=Operational, 300=Degraded, 400=Partial Outage, 500=Service Disruption/Major Outage
    if (statusCode === 100) return "operational";
    if (statusCode >= 500) return "major_outage";
    if (statusCode >= 400) return "partial_outage";
    if (statusCode >= 300) return "degraded";
    // Fallback: check status text if code is unrecognized
    if (statusText) {
      const lower = statusText.toLowerCase();
      if (lower.includes("disruption") || lower.includes("major")) return "major_outage";
      if (lower.includes("degraded")) return "degraded";
      if (lower.includes("partial")) return "partial_outage";
    }
    return "operational";
  };

  const overallStatus = mapStatusIoStatus(statusOverall.status_code || 100);
  
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
    url: "https://status.gitlab.com"
  }));
  
  const activeIncidents = allIncidents.filter((i: any) => i.status !== "resolved");
  const pastIncidents = allIncidents.filter((i: any) => i.status === "resolved").slice(0, 5);

  const uptimePct15d = calculateUptimeFromIncidents(activeIncidents, 15);

  return {
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription: statusOverall.status_text || "All Systems Operational",
    uptimePct15d,
    uptimeHistory: generateMockUptimeHistory(uptimePct15d),
    activeIncidents,
    pastIncidents,
    scheduledMaintenances: [],
    components
  };
};

export const parseStatuspal = (id: string, data: any): VendorStatus => {
  // Statuspal API returns: { services, status_page, incidents, maintenances }
  const statusPage = data.status_page || {};
  const services = data.services || [];
  const incidents = data.incidents || [];
  const maintenances = data.maintenances || [];

  // Determine overall status from status_page.current_incident_type
  // Values: null (operational), "minor", "major", "maintenance"
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

  // Parse services into components (flatten children)
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
    url: `https://status.cycode.com`
  }));
  
  const activeIncidents = allIncidents.filter((i: any) => i.status !== "resolved");
  const pastIncidents = allIncidents.filter((i: any) => i.status === "resolved").slice(0, 5);

  // Parse scheduled maintenances
  const scheduledMaintenances: Incident[] = maintenances.map((m: any) => ({
    id: String(m.id || Math.random()),
    title: m.title || m.name || "Maintenance",
    severity: "maintenance" as const,
    status: "monitoring" as const,
    startedAt: m.starts_at || m.created_at || new Date().toISOString(),
    resolvedAt: m.ends_at,
    affectedComponents: (m.services || []).map((s: any) => s.name || ""),
    updates: [],
    url: `https://status.cycode.com`
  }));

  const uptimePct15d = calculateUptimeFromIncidents(activeIncidents, 15);

  return {
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription,
    uptimePct15d,
    uptimeHistory: generateMockUptimeHistory(uptimePct15d),
    activeIncidents,
    pastIncidents,
    scheduledMaintenances,
    components: components.slice(0, 10)
  };
};

export const parseAuth0Scrape = (id: string, html: string): VendorStatus => {
  // Auth0's status page is a custom Next.js app. We scrape the HTML for status info.
  const lowerHtml = html.toLowerCase();
  
  let overallStatus: StatusLevel = "unknown";
  let statusDescription = "Unable to determine status";

  // Look for common status phrases in the page HTML
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

  // Try to extract region-level components from the page
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
    vendorId: id,
    fetchedAt: new Date().toISOString(),
    overallStatus,
    statusDescription,
    uptimePct15d: overallStatus === "operational" ? 100 : 99.9,
    uptimeHistory: generateMockUptimeHistory(overallStatus === "operational" ? 100 : 99.9),
    activeIncidents: [],
    pastIncidents: [],
    scheduledMaintenances: [],
    components: components.slice(0, 10)
  };
};
