import { VendorStatus, Incident } from "@/types";

/**
 * Adapter for Databricks Status API
 * @see https://status.databricks.com/api/v2/status.json
 */
export const DatabricksAdapter = {
    name: "Databricks",
    description: "Data & AI platform",
    accentColor: "#ff3621",
    id: "00000000-0000-4000-8000-000000000008",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://status.databricks.com/api/v2/status.json", {
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
                description: "Failed to fetch status",
                lastChecked: new Date(),
                incidents: []
            };
        }
    },

    parseResponse(data: any): VendorStatus {
        const statusMap: Record<string, "OPERATIONAL" | "DEGRADED" | "OUTAGE"> = {
            "none": "OPERATIONAL",
            "minor": "DEGRADED",
            "major": "OUTAGE",
            "critical": "OUTAGE"
        };

        const incidents: Incident[] = (data.incidents || []).map((inc: any) => ({
            id: inc.id,
            vendor_id: this.id,
            name: inc.name,
            status: inc.status,
            impact: inc.impact,
            description: inc.shortlink,
            created_at: new Date(inc.created_at),
            updated_at: new Date(inc.updated_at)
        }));

        return {
            vendor_id: this.id,
            status: statusMap[data.status?.indicator] || "OPERATIONAL",
            description: data.status?.description || "All systems operational",
            lastChecked: new Date(),
            incidents
        };
    }
};
