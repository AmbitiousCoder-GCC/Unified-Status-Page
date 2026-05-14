// lib/vendors/statusPageAdapter.ts
// Fetches live status and incident history from Atlassian Statuspage V2 public APIs.
// No auth required. Rate limit: none (public endpoints).

import { formatISO, parseISO, differenceInMinutes } from 'date-fns';
import type { VendorConfig, NormalisedIncident, VendorLiveStatus, IncidentUpdate, IncidentStatus, IncidentImpact } from '@/types/bot';

const FETCH_TIMEOUT_MS = 6000;

// Statuspage V2 raw types (subset of actual API response)
interface RawUpdate {
  body: string;
  created_at: string;
  status: string;
}

interface RawIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  resolved_at: string | null;
  incident_updates: RawUpdate[];
}

interface SummaryResponse {
  status: { indicator: string; description: string };
  incidents: RawIncident[];
}

interface IncidentsResponse {
  incidents: RawIncident[];
}

function mapStatus(raw: string): IncidentStatus {
  const s = raw.toLowerCase();
  if (s === 'investigating') return 'investigating';
  if (s === 'identified') return 'identified';
  if (s === 'monitoring') return 'monitoring';
  if (s === 'resolved') return 'resolved';
  if (s === 'postmortem') return 'postmortem';
  return 'unknown';
}

function mapImpact(raw: string): IncidentImpact {
  const i = raw.toLowerCase();
  if (i === 'none') return 'none';
  if (i === 'minor') return 'minor';
  if (i === 'major') return 'major';
  if (i === 'critical') return 'critical';
  return 'unknown';
}

function mapIndicatorToStatus(indicator: string): VendorLiveStatus['status'] {
  const i = indicator.toLowerCase();
  if (i === 'none') return 'operational';
  if (i === 'minor') return 'degraded';
  if (i === 'major' || i === 'critical') return 'outage';
  return 'unknown';
}

function normaliseIncident(raw: RawIncident, vendor: VendorConfig): NormalisedIncident {
  const updates: IncidentUpdate[] = (raw.incident_updates ?? []).map((u) => ({
    body: (u.body ?? '').slice(0, 2000),
    createdAt: u.created_at,
    status: mapStatus(u.status),
  }));

  const latestUpdate = updates[0]?.body ?? '';
  const startedAt = raw.created_at;
  const resolvedAt = raw.resolved_at ?? null;
  const durationMinutes =
    resolvedAt
      ? differenceInMinutes(parseISO(resolvedAt), parseISO(startedAt))
      : null;

  return {
    id: `${vendor.id}:${raw.id}`,
    vendorId: vendor.id,
    vendorName: vendor.displayName,
    externalId: raw.id,
    name: raw.name,
    status: mapStatus(raw.status),
    impact: mapImpact(raw.impact),
    startedAt,
    resolvedAt,
    durationMinutes,
    latestUpdate,
    updates,
    source: 'vendor_api',
  };
}

async function safeFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 60 } });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStatuspageV2(
  vendor: VendorConfig
): Promise<{ liveStatus: VendorLiveStatus; recentIncidents: NormalisedIncident[] } | null> {
  if (!vendor.apiBaseUrl) return null;

  const now = formatISO(new Date());

  try {
    const [summaryRes, incidentsRes] = await Promise.all([
      safeFetch(`${vendor.apiBaseUrl}/summary.json`),
      safeFetch(`${vendor.apiBaseUrl}/incidents.json`),
    ]);

    if (!summaryRes.ok || !incidentsRes.ok) {
      console.error(`[Bot] ${vendor.displayName} API returned non-200: summary=${summaryRes.status} incidents=${incidentsRes.status}`);
      return null;
    }

    const summary: SummaryResponse = await summaryRes.json();
    const incidentsData: IncidentsResponse = await incidentsRes.json();

    const activeIncidents = (summary.incidents ?? []).map((i) =>
      normaliseIncident(i, vendor)
    );

    const recentIncidents = (incidentsData.incidents ?? [])
      .slice(0, 50)
      .map((i) => normaliseIncident(i, vendor));

    const liveStatus: VendorLiveStatus = {
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      status: mapIndicatorToStatus(summary.status?.indicator ?? 'none'),
      activeIncidents,
      lastFetchedAt: now,
    };

    return { liveStatus, recentIncidents };
  } catch (err) {
    console.error(`[Bot] Failed to fetch ${vendor.displayName} (statuspage_v2):`, err);
    return null;
  }
}
