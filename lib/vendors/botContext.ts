// lib/vendors/botContext.ts
import type { IncidentCache } from '@/types/bot';
import {
  getAllLiveStatuses,
  getAllActiveIncidents,
  getRecentIncidents,
  getAnalytics,
  searchIncidents,
} from '@/lib/vendors/incidentStore';
import { findVendorByName, KNOWN_VENDOR_NAMES } from '@/lib/vendors/vendorRegistry';
import { formatDistanceToNow, parseISO } from 'date-fns';

export interface BotContext {
  dataBlock: string;    // injected into LLM system prompt
  sources: string[];    // which vendors were queried
  dataAsOf: string;     // ISO8601 UTC
  hasData: boolean;
}

export function buildBotContext(question: string, cache: IncidentCache): BotContext {
  const q = question.toLowerCase();
  const sources: string[] = [];
  const blocks: string[] = [];
  const now = new Date().toISOString();

  // Detect mentioned vendor
  const mentionedVendor = findVendorByName(question);

  // Always include live status summary
  const liveStatuses = getAllLiveStatuses(cache);
  if (liveStatuses.length > 0) {
    sources.push('live_status');
    const statusLines = liveStatuses.map((s) => {
      const emoji = s.status === 'operational' ? '🟢' : s.status === 'degraded' ? '🟡' : s.status === 'outage' ? '🔴' : '⚪';
      const active = s.activeIncidents.length > 0
        ? ` — ${s.activeIncidents.length} active incident(s): ${s.activeIncidents.map(i => i.name).join(', ')}`
        : '';
      return `${emoji} ${s.vendorName}: ${s.status}${active} (as of ${formatDistanceToNow(parseISO(s.lastFetchedAt))} ago)`;
    });
    blocks.push(`## CURRENT LIVE STATUS\n${statusLines.join('\n')}`);
  }

  // Active incidents
  if (q.includes('active') || q.includes('current') || q.includes('right now') || q.includes('ongoing') || q.includes('down') || q.includes('outage')) {
    const active = mentionedVendor
      ? cache[mentionedVendor.id]?.liveStatus.activeIncidents ?? []
      : getAllActiveIncidents(cache);
    sources.push('active_incidents');
    if (active.length === 0) {
      blocks.push(`## ACTIVE INCIDENTS\nNo active incidents found${mentionedVendor ? ` for ${mentionedVendor.displayName}` : ''}.`);
    } else {
      const lines = active.map((i) =>
        `- [${i.impact.toUpperCase()}] ${i.vendorName}: "${i.name}" — started ${formatDistanceToNow(parseISO(i.startedAt))} ago. Latest: ${i.latestUpdate.slice(0, 300)}`
      );
      blocks.push(`## ACTIVE INCIDENTS\n${lines.join('\n')}`);
    }
  }

  // Recent incident history
  if (q.includes('last') || q.includes('recent') || q.includes('history') || q.includes('past') || q.includes('previous') || q.includes('incident') || mentionedVendor) {
    const vendorId = mentionedVendor?.id ?? null;
    const recent = getRecentIncidents(cache, vendorId, 20);
    sources.push('incident_history');
    if (recent.length === 0) {
      blocks.push(`## RECENT INCIDENTS\nNo historical incidents found${mentionedVendor ? ` for ${mentionedVendor.displayName}` : ''}. This may be beyond the available data range.`);
    } else {
      const lines = recent.map((i) => {
        const duration = i.durationMinutes ? ` (${i.durationMinutes}min)` : '';
        const resolved = i.resolvedAt ? `resolved ${formatDistanceToNow(parseISO(i.resolvedAt))} ago` : 'UNRESOLVED';
        return `- [${i.impact.toUpperCase()}] ${i.vendorName}: "${i.name}" — ${resolved}${duration}`;
      });
      blocks.push(`## RECENT INCIDENTS (last 20)\n${lines.join('\n')}`);
    }
  }

  // Analytics
  if (q.includes('analyt') || q.includes('how many') || q.includes('average') || q.includes('mttr') || q.includes('mean time') || q.includes('trend') || q.includes('frequent') || q.includes('reliable') || q.includes('worst') || q.includes('best')) {
    const vendorId = mentionedVendor?.id ?? null;
    const analytics = getAnalytics(cache, vendorId);
    sources.push('analytics');
    blocks.push(`## ANALYTICS${mentionedVendor ? ` — ${mentionedVendor.displayName}` : ' — ALL VENDORS'}
- Total incidents in data: ${analytics.totalIncidents}
- Resolved incidents: ${analytics.resolvedIncidents}
- Average duration: ${analytics.avgDurationMinutes !== null ? `${analytics.avgDurationMinutes} minutes` : 'insufficient data'}
- MTTR: ${analytics.mttrMinutes !== null ? `${analytics.mttrMinutes} minutes` : 'insufficient data'}
- Impact breakdown: ${JSON.stringify(analytics.impactBreakdown)}
- Most recent: ${analytics.mostRecentIncident ? `"${analytics.mostRecentIncident.name}" (${analytics.mostRecentIncident.vendorName})` : 'none'}`);
  }

  // Full-text search
  if (q.includes('search') || q.includes('find') || q.includes('related to') || q.includes('about')) {
    const searchQuery = question.replace(/search|find|related to|about/gi, '').trim();
    if (searchQuery.length > 2) {
      const found = searchIncidents(cache, searchQuery);
      sources.push('search');
      if (found.length > 0) {
        const lines = found.slice(0, 10).map((i) =>
          `- ${i.vendorName}: "${i.name}" [${i.status}] ${i.startedAt}`
        );
        blocks.push(`## SEARCH RESULTS for "${searchQuery}"\n${lines.join('\n')}`);
      }
    }
  }

  const hasData = liveStatuses.length > 0 || blocks.length > 1;

  return {
    dataBlock: blocks.join('\n\n'),
    sources: [...new Set(sources)],
    dataAsOf: now,
    hasData,
  };
}
