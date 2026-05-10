import { NextRequest, NextResponse } from "next/server";
import { VENDORS } from "@/lib/vendors";
import { parseStatuspage, parseGcp, parseAzureRss } from "@/lib/statusParser";

export const runtime = "edge";
export const revalidate = 60; // Cache for 60 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: { vendor: string } }
) {
  const vendorId = params.vendor;
  const vendorConfig = VENDORS.find(v => v.id === vendorId);

  if (!vendorConfig) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const res = await fetch(vendorConfig.apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json"
      },
      next: { revalidate: 60 }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch from ${vendorConfig.apiUrl}`);
    }

    let statusData;

    if (vendorConfig.parser === "gcp") {
      const data = await res.json();
      statusData = parseGcp(vendorConfig.id, data);
    } else if (vendorConfig.parser === "azure_rss") {
      const text = await res.text();
      console.log(`Raw Azure RSS Feed for ${vendorId}:`, text.substring(0, 500));
      statusData = parseAzureRss(vendorConfig.id, text);
    } else {
      const data = await res.json();
      
      // Try to fetch uptime_30d.json if applicable (standard statuspage)
      try {
        const uptimeUrl = vendorConfig.apiUrl.replace("summary.json", "uptime_30d.json");
        const uptimeRes = await fetch(uptimeUrl, { next: { revalidate: 60 } });
        if (uptimeRes.ok) {
          const uptimeData = await uptimeRes.json();
          // uptimeData usually has daily stats
          // For simplicity, we skip full parsing here and let parser do fallback if needed
          // Real implementation would parse this uptimeData properly
        }
      } catch (e) {
        // Ignore uptime fetch errors, fallback to incidents logic
      }

      statusData = parseStatuspage(vendorConfig.id, data);
    }

    return NextResponse.json(statusData, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (error: any) {
    console.error(`Error fetching status for ${vendorId}:`, error.message);
    
    // Return a degraded/unknown state instead of failing completely
    return NextResponse.json({
      vendorId: vendorConfig.id,
      fetchedAt: new Date().toISOString(),
      overallStatus: "unknown",
      statusDescription: "Failed to fetch status",
      uptimePct30d: 100,
      uptimeHistory: [],
      activeIncidents: [],
      scheduledMaintenances: [],
      components: []
    }, { 
      status: 200, // Keep 200 so UI doesn't crash, just shows unknown
      headers: { "Cache-Control": "s-maxage=60" } 
    });
  }
}
