import { VendorStatus, Incident } from "@/types";

/**
 * Adapter for AWS Status API
 * @see https://status.aws.amazon.com/data.json
 */
export const AWSAdapter = {
    name: "AWS",
    id: "00000000-0000-4000-8000-000000000005",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.aws.amazon.com/data.json", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResponse(data);
        } catch (error) {
            console.error("AWS fetch failed:", error);
            return {
                vendor_id: this.id,
                status: "OPERATIONAL",
                description: "Failed to fetch status",
                lastChecked: new Date(),
                incidents: []
            };
        }
    },

    parseResponse(data: any): VendorStatus {
        const currentIncidents = data.current || [];
        
        const incidents: Incident[] = currentIncidents.map((inc: any) => ({
            id: inc.guid,
            vendor_id: this.id,
            name: inc.title,
            status: "Active",
            impact: "Unknown",
            description: inc.description,
            created_at: new Date(parseInt(inc.epoch) * 1000),
            updated_at: new Date()
        }));

        const status = incidents.length > 0 ? "DEGRADED" : "OPERATIONAL";

        return {
            vendor_id: this.id,
            status,
            description: status === "OPERATIONAL" ? "All services operational" : `${incidents.length} current service alerts`,
            lastChecked: new Date(),
            incidents
        };
    }
};
