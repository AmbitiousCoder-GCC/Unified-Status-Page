import { VendorStatus, Incident } from "@/types/status";

/**
 * Adapter for Microsoft Fabric Status (Scraper)
 * @see https://support.fabric.microsoft.com/support/
 */
export const MicrosoftFabricAdapter = {
    name: "Microsoft Fabric",
    description: "Data analytics & BI platform",
    accentColor: "#0078d4",
    id: "00000000-0000-4000-8000-000000000013",

    async fetchStatus(): Promise<VendorStatus> {
        try {
            const response = await fetch("https://support.fabric.microsoft.com/support/", {
                signal: AbortSignal.timeout(10000),
                headers: { 
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            
            // Very simple scraping logic: 
            // Look for "Good" status indicators which are common in Microsoft's status pages.
            // If "Outage" or "Degraded" appears near service names, we might flag it.
            const isOperational = html.includes("Good") && !html.includes("Major Outage") && !html.includes("Service Outage");
            
            return {
                vendor_id: this.id,
                status: isOperational ? "OPERATIONAL" : "DEGRADED",
                description: isOperational ? "All systems operational" : "Potential service issues reported",
                lastChecked: new Date(),
                incidents: []
            };
        } catch (error) {
            console.error("Microsoft Fabric fetch failed:", error);
            return {
                vendor_id: this.id,
                status: "OPERATIONAL", // Default to operational on fetch failure
                description: "Operational (Status page currently unreachable)",
                lastChecked: new Date(),
                incidents: []
            };
        }
    }
};
