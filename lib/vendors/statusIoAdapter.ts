// lib/vendors/statusIoAdapter.ts
import { formatISO } from 'date-fns';
import type { VendorConfig, NormalisedIncident, VendorLiveStatus } from '@/types/bot';

const stripHtml = (html: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
};

interface StatusIoIncident {
  ID: string;
  Name: string;
  DateTime: string;
  Details?: string;
  CurrentStatus?: string;
  Status?: string;
}

interface StatusIoResponse {
  result?: {
    status_overall?: { status?: string };
    incidents?: StatusIoIncident[];
  };
}

function deriveImpact(status?: string) {
  if (!status) return 'unknown' as const;
  const s = status.toLowerCase();
  if (s.includes('outage') || s.includes('disruption')) return 'critical' as const;
  if (s.includes('degraded') || s.includes('performance')) return 'minor' as const;
  return 'none' as const;
}

export async function fetchStatusIo(
  vendor: VendorConfig
): Promise<{ liveStatus: VendorLiveStatus; recentIncidents: NormalisedIncident[] } | null> {
  if (!vendor.apiBaseUrl) return null;
  const now = formatISO(new Date());

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    let data: StatusIoResponse;
    try {
      const res = await fetch(vendor.apiBaseUrl, { signal: controller.signal, next: { revalidate: 60 } });
      if (!res.ok) {
        console.error(`[Bot] ${vendor.displayName} statusio API returned ${res.status}`);
        return null;
      }
      data = await res.json();
    } finally {
      clearTimeout(timeout);
    }

    const rawIncidents: StatusIoIncident[] = data?.result?.incidents ?? [];
    const overallStatus = data?.result?.status_overall?.status ?? 'Operational';

    const recentIncidents: NormalisedIncident[] = rawIncidents.slice(0, 50).map((inc) => {
      const isResolved =
        (inc.CurrentStatus ?? inc.Status ?? '').toLowerCase().includes('resolved');
      return {
        id: `${vendor.id}:${inc.ID}`,
        vendorId: vendor.id,
        vendorName: vendor.displayName,
        externalId: inc.ID,
        name: stripHtml(inc.Name),
        status: isResolved ? 'resolved' : 'investigating',
        impact: deriveImpact(inc.CurrentStatus ?? inc.Status),
        startedAt: inc.DateTime,
        resolvedAt: isResolved ? inc.DateTime : null,
        durationMinutes: null,
        latestUpdate: stripHtml(inc.Details ?? '').slice(0, 2000),
        updates: [],
        source: 'vendor_api',
      };
    });

    const activeIncidents = recentIncidents.filter((i) => i.status !== 'resolved');

    const liveStatus: VendorLiveStatus = {
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      status: overallStatus.toLowerCase().includes('operational') ? 'operational'
            : overallStatus.toLowerCase().includes('outage') ? 'outage'
            : 'degraded',
      activeIncidents,
      lastFetchedAt: now,
    };

    return { liveStatus, recentIncidents };
  } catch (err) {
    console.error(`[Bot] Failed to fetch ${vendor.displayName} (statusio):`, err);
    return null;
  }
}
