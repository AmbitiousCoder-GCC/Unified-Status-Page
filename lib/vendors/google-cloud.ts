import { VendorStatus, Incident } from "@/types";

/**
 * Adapter for Google Cloud Status API
 * @see https://status.cloud.google.com/incidents.json
 */
export const GoogleCloudAdapter = {
    name: "Google Cloud",
    description: "Google cloud services",
    accentColor: "#4285f4",
    id: "00000000-0000-4000-8000-000000000004",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.cloud.google.com/incidents.json", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResponse(data);
        } catch (error) {
            console.error("GCP fetch failed:", error);
            return {
                vendor_id: this.id,
                status: "OPERATIONAL",
                description: "Failed to fetch status",
                lastChecked: new Date(),
                incidents: []
            };
        }
    },

    parseResponse(data: any[]): VendorStatus {
        // GCP incidents are returned as an array of objects
        // Filter for active incidents (usually no 'end' time or very recent)
        const activeIncidents = data.filter(inc => !inc.end || new Date(inc.end) > new Date());
        
        const incidents: Incident[] = activeIncidents.slice(0, 10).map((inc: any) => ({
            id: inc.external_id || inc.number,
            vendor_id: this.id,
            name: inc.service_name + ": " + inc.external_id,
            status: inc.status_impact,
            impact: inc.severity,
            description: inc.most_recent_update?.text || "No details available",
            created_at: new Date(inc.begin),
            updated_at: new Date(inc.modified)
        }));

        const status = activeIncidents.length > 0 ? (activeIncidents.some(i => i.severity === "high") ? "OUTAGE" : "DEGRADED") : "OPERATIONAL";

        return {
            vendor_id: this.id,
            status,
            description: status === "OPERATIONAL" ? "All services operational" : `${activeIncidents.length} active incidents detected`,
            lastChecked: new Date(),
            incidents
        };
    }
};
