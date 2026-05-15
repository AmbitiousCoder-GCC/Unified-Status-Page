import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/security/api";
import { refreshVendorData } from "@/lib/vendors";

/**
 * CRON endpoint for synchronizing vendor status data.
 * Secured by a secret token and implements execution timeouts.
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Validate CRON secret (Timing-safe comparison)
        const authHeader = request.headers.get("authorization");
        if (!validateCronSecret(authHeader)) {
            console.warn("Unauthorized attempt to trigger CRON job");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Set timeout to prevent hanging jobs (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            // 3. Refresh vendor data in parallel
            const refreshPromise = refreshVendorData();
            
            // Race between refresh and timeout
            const result = await Promise.race([
                refreshPromise,
                new Promise((_, reject) =>
                    controller.signal.addEventListener('abort', () =>
                        reject(new Error('CRON job timed out after 30 seconds'))
                    )
                ),
            ]);

            return NextResponse.json({
                success: true,
                timestamp: new Date().toISOString(),
                result,
            });
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error: any) {
        console.error("CRON job execution failed:", error);
        
        return NextResponse.json(
            { error: error.message || "CRON job failed" },
            { status: 500 }
        );
    }
}
