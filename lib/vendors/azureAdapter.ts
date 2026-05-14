// lib/vendors/azureAdapter.ts
import { XMLParser } from 'fast-xml-parser';
import { formatISO } from 'date-fns';
import type { VendorConfig, NormalisedIncident, VendorLiveStatus } from '@/types/bot';

const stripHtml = (html: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export async function fetchAzure(
  vendor: VendorConfig
): Promise<{ liveStatus: VendorLiveStatus; recentIncidents: NormalisedIncident[] } | null> {
  if (!vendor.apiBaseUrl) return null;
  const now = formatISO(new Date());

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let text: string;
    try {
      const res = await fetch(vendor.apiBaseUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
        next: { revalidate: 120 },
      });
      if (!res.ok) {
        console.error(`[Bot] Azure feed returned ${res.status}`);
        return null;
      }
      text = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    const parsed = parser.parse(text);
    const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
    const rawItems: Record<string, unknown>[] = Array.isArray(channel.item)
      ? channel.item
      : channel.item
      ? [channel.item]
      : Array.isArray(channel.entry)
      ? channel.entry
      : channel.entry
      ? [channel.entry]
      : [];

    const recentIncidents: NormalisedIncident[] = rawItems.slice(0, 50).map((item, idx) => {
      const title = String(item.title ?? 'Azure Incident');
      const pubDate = String(item.pubDate ?? item.updated ?? now);
      const summary = String(item.summary ?? item.description ?? '').slice(0, 2000);
      const link = String(item.link ?? item['@_href'] ?? '');
      const titleLower = title.toLowerCase();

      const isResolved = titleLower.includes('resolved') || titleLower.includes('completed');
      const isCritical = titleLower.includes('outage') || titleLower.includes('unavailable');

      return {
        id: `azure:${link || idx}`,
        vendorId: vendor.id,
        vendorName: vendor.displayName,
        externalId: link || String(idx),
        name: stripHtml(title),
        status: isResolved ? 'resolved' : 'investigating',
        impact: isCritical ? 'critical' : 'minor',
        startedAt: pubDate,
        resolvedAt: isResolved ? pubDate : null,
        durationMinutes: null,
        latestUpdate: stripHtml(summary),
        updates: [],
        source: 'vendor_api',
      };
    });

    const activeIncidents = recentIncidents.filter((i) => i.status !== 'resolved');

    const liveStatus: VendorLiveStatus = {
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      status: activeIncidents.length > 0
        ? activeIncidents.some((i) => i.impact === 'critical') ? 'outage' : 'degraded'
        : 'operational',
      activeIncidents,
      lastFetchedAt: now,
    };

    return { liveStatus, recentIncidents };
  } catch (err) {
    console.error(`[Bot] Failed to fetch Azure feed:`, err);
    return null;
  }
}
