import { VendorStatus, Incident } from "@/types";

/**
 * Adapter for Microsoft Azure Status API
 * @see https://status.azure.com/api/v1/status
 */
export const AzureAdapter = {
    name: "Azure",
    description: "Microsoft cloud platform",
    accentColor: "#0078d4",
    id: "00000000-0000-4000-8000-000000000003",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.azure.com/api/v1/status", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResponse(data);
        } catch (error) {
            console.error("Azure fetch failed:", error);
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
        // Azure status often returns a list of zones and services
        // We look for active incidents or non-zero status codes
        const status = data.status === "Information" || data.status === "Good" ? "OPERATIONAL" : "DEGRADED";
        
        const incidents: Incident[] = (data.incidents || []).map((inc: any) => ({
            id: inc.id || Math.random().toString(36).substr(2, 9),
            vendor_id: this.id,
            name: inc.title || "Azure Service Issue",
            status: inc.status || "Active",
            impact: inc.impact || "Medium",
            description: inc.description,
            created_at: inc.startTime ? new Date(inc.startTime) : new Date(),
            updated_at: inc.lastUpdateTime ? new Date(inc.lastUpdateTime) : new Date()
        }));

        return {
            vendor_id: this.id,
            status,
            description: data.message || (status === "OPERATIONAL" ? "All services operational" : "Potential issues detected"),
            lastChecked: new Date(),
            incidents
        };
    }
};
