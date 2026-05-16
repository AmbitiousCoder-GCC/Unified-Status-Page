import { VendorStatus, Incident } from "@/types";

/**
 * Adapter for Cloudflare Status API
 * @see https://www.cloudflarestatus.com/api/v2/status.json
 */
export const CloudflareAdapter = {
    name: "Cloudflare",
    description: "CDN & security services",
    accentColor: "#f38020",
    id: "00000000-0000-4000-8000-000000000006",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://www.cloudflarestatus.com/api/v2/summary.json", {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "status-page-monitor" }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResponse(data);
        } catch (error) {
            console.error("Cloudflare fetch failed:", error);
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

        // Determine status: Trust the indicator, but if there's a non-resolved incident, mark as DEGRADED
        const hasActiveIncident = incidents.some(inc => 
            inc.status.toLowerCase() !== "resolved" && 
            inc.status.toLowerCase() !== "completed" &&
            inc.status.toLowerCase() !== "postmortem"
        );

        let status = statusMap[data.status?.indicator] || "OPERATIONAL";
        if (status === "OPERATIONAL" && hasActiveIncident) {
            status = "DEGRADED";
        }

        return {
            vendor_id: this.id,
            status,
            description: status === "OPERATIONAL" ? "All services operational" : (hasActiveIncident ? "Active incident reported" : data.status?.description),
            lastChecked: new Date(),
            incidents
        };
    }
};
