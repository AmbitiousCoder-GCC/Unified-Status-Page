import { ParseResult, StatusParser } from './types';
import { Incident } from '@/types/status';
import { XMLParser } from "fast-xml-parser";

export class AzureRssParser implements StatusParser {
  constructor(public readonly vendorId: string, public readonly vendorName: string) {}

  validateInput(data: unknown): boolean {
    return typeof data === 'string' && data.includes('<?xml');
  }

  parse(data: unknown): ParseResult {
    if (!this.validateInput(data)) {
      return this.fallbackResult();
    }

    const xmlString = data as string;
    const parser = new XMLParser();
    const result = parser.parse(xmlString);
    
    const items = result?.rss?.channel?.item || [];
    const itemsArray = Array.isArray(items) ? items : [items];
    
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
      fetchedAt: new Date().toISOString(),
      overallStatus,
      statusDescription: activeIncidents.length > 0 ? "Azure Services Degraded" : "All Systems Operational",
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
