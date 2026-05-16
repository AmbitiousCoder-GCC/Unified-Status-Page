import { GitHubAdapter } from "./github";
import { MongoDBAdapter } from "./mongodb";
import { AzureAdapter } from "./azure";
import { GoogleCloudAdapter } from "./google-cloud";
import { AWSAdapter } from "./aws";
import { CloudflareAdapter } from "./cloudflare";
import { GitLabAdapter } from "./gitlab";
import { DatabricksAdapter } from "./databricks";

import { SnowflakeAdapter } from "./snowflake";
import { SailPointAdapter } from "./sailpoint";
import { CycodeAdapter } from "./cycode";
import { MicrosoftFabricAdapter } from "./microsoft-fabric";
import { updateVendorStatus } from "@/lib/db/queries";

/**
 * Registry of all supported vendor adapters.
 */
export const VENDORS: Record<string, any> = {
    github: GitHubAdapter,
    mongodb: MongoDBAdapter,
    azure: AzureAdapter,
    gcp: GoogleCloudAdapter,
    aws: AWSAdapter,
    cloudflare: CloudflareAdapter,
    gitlab: GitLabAdapter,
    databricks: DatabricksAdapter,

    snowflake: SnowflakeAdapter,
    sailpoint: SailPointAdapter,
    cycode: CycodeAdapter,
    fabric: MicrosoftFabricAdapter,
};

/**
 * List of all supported vendor adapters for iteration.
 */
export const VENDORS_LIST = Object.values(VENDORS);

/**
 * Refreshes status data for all vendors in parallel.
 * Saves results to the database and handles partial failures.
 */
export async function refreshVendorData(): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    const results = await Promise.allSettled(
        Object.values(VENDORS).map(async (adapter) => {
            const status = await adapter.fetchStatus();
            await updateVendorStatus(
                status.vendor_id,
                status.status,
                status.description,
                status.incidents
            );
            return adapter.id;
        })
    );

    results.forEach((result, index) => {
        const adapterId = Object.keys(VENDORS)[index];
        if (result.status === "fulfilled") {
            success.push(adapterId);
        } else {
            console.error(`Failed to refresh vendor ${adapterId}:`, result.reason);
            failed.push(adapterId);
        }
    });

    return { success, failed };
}

/**
 * Retrieves a specific vendor adapter by ID.
 */
export function getVendor(id: string) {
    return VENDORS[id];
}
