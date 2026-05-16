import { VendorStatus } from "@/types";

/**
 * Adapter for GitLab Status API (RSS Feed)
 * @see https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss
 */
export const GitLabAdapter = {
    name: "GitLab",
    description: "DevOps platform",
    accentColor: "#fc6d26",
    id: "00000000-0000-4000-8000-000000000007",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const xml = await response.text();
            return this.parseRSS(xml);
        } catch (error) {
            console.error("GitLab fetch failed:", error);
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
        // Simple RSS parsing for GitLab
        const hasActiveIncidents = xml.includes("<item>") && 
                                  !xml.includes("Resolved") && 
                                  (xml.includes("Outage") || xml.includes("Degraded") || xml.includes("Issue"));
        
        const status = hasActiveIncidents ? "DEGRADED" : "OPERATIONAL";
        
        return {
            vendor_id: this.id,
            status,
            description: status === "OPERATIONAL" ? "All services operational" : "Active service issues reported in GitLab RSS feed",
            lastChecked: new Date(),
            incidents: []
        };
    }
};
