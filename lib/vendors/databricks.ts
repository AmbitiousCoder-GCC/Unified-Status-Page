import { VendorStatus } from "@/types";

/**
 * Adapter for Databricks Status API
 * @see https://status.azuredatabricks.net/1.0/status/5d49ec10226b9e13cb6a422e
 */
export const DatabricksAdapter = {
    name: "Databricks",
    description: "Data & AI platform",
    accentColor: "#ff3621",
    id: "00000000-0000-4000-8000-000000000008",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.azuredatabricks.net/1.0/status/5d49ec10226b9e13cb6a422e", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResponse(data);
        } catch (error) {
            console.error("Databricks fetch failed:", error);
            return {
                vendor_id: this.id,
                status: "OPERATIONAL",
                description: "Operational (Status page currently unreachable)",
                lastChecked: new Date(),
                incidents: []
            };
        }
    },

    parseResponse(data: any): VendorStatus {
        const overall = data.result?.status_overall?.status || "Operational";
        const status = overall === "Operational" ? "OPERATIONAL" : "DEGRADED";
        
        return {
            vendor_id: this.id,
            status,
            description: overall === "Operational" ? "All services operational" : "Active service issues detected",
            lastChecked: new Date(),
            incidents: []
        };
    }
};
