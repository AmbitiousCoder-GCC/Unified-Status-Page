import { VendorStatus } from "@/types";

/**
 * Adapter for Microsoft Azure Status API (RSS Feed)
 * @see https://rssfeed.azure.status.microsoft/en-us/status/feed/
 */
export const AzureAdapter = {
    name: "Azure",
    description: "Microsoft cloud platform",
    accentColor: "#0078d4",
    id: "00000000-0000-4000-8000-000000000003",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://rssfeed.azure.status.microsoft/en-us/status/feed/", {
                signal: AbortSignal.timeout(10000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const xml = await response.text();
            return this.parseRSS(xml);
        } catch (error) {
            console.error("Azure fetch failed:", error);
            return {
                vendor_id: this.id,
                status: "OPERATIONAL",
                description: "Operational (Status page currently unreachable)",
                lastChecked: new Date(),
                incidents: []
            };
        }
    },

    parseRSS(xml: string): VendorStatus {
        // Simple RSS parsing for Azure
        // We look for active items. If there are items that don't say "Resolved", 
        // or if there's a recent "Outage" or "Degraded" mentioned, we flag it.
        const hasActiveIncidents = xml.includes("<item>") && 
                                  !xml.includes("Resolved") && 
                                  (xml.includes("Outage") || xml.includes("Degraded") || xml.includes("Issue"));
        
        const status = hasActiveIncidents ? "DEGRADED" : "OPERATIONAL";
        
        return {
            vendor_id: this.id,
            status,
            description: status === "OPERATIONAL" ? "All services operational" : "Active service issues reported in Azure RSS feed",
            lastChecked: new Date(),
            incidents: []
        };
    }
};
