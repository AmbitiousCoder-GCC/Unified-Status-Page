import { NextRequest, NextResponse } from "next/server";
import { VENDORS } from "@/lib/vendors";
import { VendorStatus } from "@/types/status";

export const runtime = "edge";
export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: NextRequest) {
  // Determine the base URL for fetching the local proxy endpoints
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  try {
    const promises = VENDORS.map(vendor => 
      fetch(`${baseUrl}/api/status/${vendor.id}`)
        .then(res => res.json() as Promise<VendorStatus>)
        .catch(err => {
          console.error(`Failed to aggregate ${vendor.id}:`, err);
          return {
            vendorId: vendor.id,
            fetchedAt: new Date().toISOString(),
            overallStatus: "unknown",
            statusDescription: "Failed to fetch status",
            uptimePct30d: 100,
            uptimeHistory: [],
            activeIncidents: [],
            scheduledMaintenances: [],
            components: []
          } as VendorStatus;
        })
    );

    const statuses = await Promise.all(promises);

    return NextResponse.json(statuses, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (error: any) {
    console.error("Aggregate error:", error.message);
    return NextResponse.json({ error: "Failed to aggregate statuses" }, { status: 500 });
  }
}
