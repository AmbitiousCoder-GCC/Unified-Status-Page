// lib/vendors/incidentStore.ts
// In-memory cache of vendor incident data.
// On Vercel, this lives per serverless instance — Next.js fetch cache handles
// cross-instance consistency via revalidate intervals set in each adapter.

import type { IncidentCache, NormalisedIncident, VendorLiveStatus } from '@/types/bot';
import { VENDOR_REGISTRY } from '@/lib/vendors/vendorRegistry';
import { fetchStatuspageV2 } from '@/lib/vendors/statusPageAdapter';
import { fetchStatusIo } from '@/lib/vendors/statusIoAdapter';
import { fetchAzure } from '@/lib/vendors/azureAdapter';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache (per serverless instance)
let cache: IncidentCache = {};
let lastFullFetch = 0;

export async function getIncidentCache(): Promise<IncidentCache> {
  const now = Date.now();
  if (now - lastFullFetch < CACHE_TTL_MS && Object.keys(cache).length > 0) {
    return cache;
  }
  await refreshCache();
  return cache;
}

async function refreshCache(): Promise<void> {
  const results = await Promise.allSettled(
    VENDOR_REGISTRY.map(async (vendor) => {
      let result = null;

      if (vendor.apiType === 'statuspage_v2') {
        result = await fetchStatuspageV2(vendor);
      } else if (vendor.apiType === 'statusio') {
        result = await fetchStatusIo(vendor);
      } else if (vendor.apiType === 'azure') {
        result = await fetchAzure(vendor);
      }

      if (result) {
        cache[vendor.id] = {
          liveStatus: result.liveStatus,
          recentIncidents: result.recentIncidents,
          fetchedAt: Date.now(),
        };
      }
    })
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[Bot] Cache refresh failed for vendor index ${i}:`, r.reason);
    }
  });

  lastFullFetch = Date.now();
}

// ── Query helpers used by the bot ──────────────────────────────────

export function getAllLiveStatuses(c: IncidentCache): VendorLiveStatus[] {
  return Object.values(c).map((v) => v.liveStatus);
}

export function getVendorLiveStatus(c: IncidentCache, vendorId: string): VendorLiveStatus | null {
  return c[vendorId]?.liveStatus ?? null;
}

export function getAllActiveIncidents(c: IncidentCache): NormalisedIncident[] {
  return Object.values(c)
    .flatMap((v) => v.liveStatus.activeIncidents)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getRecentIncidents(
  c: IncidentCache,
  vendorId: string | null,
  limit = 20
): NormalisedIncident[] {
  if (vendorId) {
    return (c[vendorId]?.recentIncidents ?? []).slice(0, limit);
  }
  return Object.values(c)
    .flatMap((v) => v.recentIncidents)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

export function searchIncidents(c: IncidentCache, query: string): NormalisedIncident[] {
  const q = query.toLowerCase();
  // Search across both active and recent incidents
  const allIncidents: NormalisedIncident[] = [];
  const seen = new Set<string>();

  for (const v of Object.values(c)) {
    // Include active incidents
    for (const inc of v.liveStatus.activeIncidents) {
      if (!seen.has(inc.id)) {
        seen.add(inc.id);
        allIncidents.push(inc);
      }
    }
    // Include recent incidents
    for (const inc of v.recentIncidents) {
      if (!seen.has(inc.id)) {
        seen.add(inc.id);
        allIncidents.push(inc);
      }
    }
  }

  return allIncidents
    .filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.latestUpdate.toLowerCase().includes(q) ||
        i.vendorName.toLowerCase().includes(q) ||
        i.updates.some((u) => u.body.toLowerCase().includes(q))
    )
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 30);
}

export interface AnalyticsResult {
  vendorId: string | null;
  totalIncidents: number;
  resolvedIncidents: number;
  avgDurationMinutes: number | null;
  mttrMinutes: number | null;
  impactBreakdown: Record<string, number>;
  mostRecentIncident: NormalisedIncident | null;
}

export function getAnalytics(
  c: IncidentCache,
  vendorId: string | null
): AnalyticsResult {
  const incidents = getRecentIncidents(c, vendorId, 200);
  const resolved = incidents.filter((i) => i.resolvedAt !== null && i.durationMinutes !== null);
  const durations = resolved.map((i) => i.durationMinutes as number).filter((d) => d > 0);

  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const impactBreakdown: Record<string, number> = {};
  for (const inc of incidents) {
    impactBreakdown[inc.impact] = (impactBreakdown[inc.impact] ?? 0) + 1;
  }

  return {
    vendorId,
    totalIncidents: incidents.length,
    resolvedIncidents: resolved.length,
    avgDurationMinutes: avgDuration,
    mttrMinutes: avgDuration,
    impactBreakdown,
    mostRecentIncident: incidents[0] ?? null,
  };
}
