import { NextRequest, NextResponse } from "next/server";
import { checkIncidentsRateLimit } from "@/lib/security/api";
import { getIncidents } from "@/lib/db/queries";
import { validateIncidentFilters } from "@/lib/validation/chat";

/**
 * Incidents endpoint for fetching historical status data.
 * Implements rate limiting, input validation, and HTTP caching.
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Check rate limit (30 req/min)
        const isAllowed = await checkIncidentsRateLimit(request);
        if (!isAllowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded" },
                { status: 429 }
            );
        }

        // 2. Parse and validate query parameters
        const searchParams = request.nextUrl.searchParams;
        const filters = {
            vendor_id: searchParams.get("vendor_id") || undefined,
            status: searchParams.get("status") || undefined,
            limit: parseInt(searchParams.get("limit") || "20"),
            offset: parseInt(searchParams.get("offset") || "0"),
        };

        const validated = validateIncidentFilters(filters);
        if (!validated.success) {
            return NextResponse.json(
                { error: "Invalid query parameters", details: validated.error.flatten() },
                { status: 400 }
            );
        }

        // 3. Query incidents from database
        const incidents = await getIncidents(validated.data);

        // 4. Return with caching headers for performance
        return NextResponse.json(
            {
                incidents,
                count: incidents.length,
                timestamp: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
                },
            }
        );
    } catch (error) {
        console.error("Incidents endpoint error:", error);
        
        return NextResponse.json(
            { error: "Failed to fetch incidents" },
            { status: 500 }
        );
    }
}
