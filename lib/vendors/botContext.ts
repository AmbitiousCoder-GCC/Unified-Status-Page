// lib/vendors/botContext.ts
import type { IncidentCache, NormalisedIncident } from '@/types/bot';
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
  dataBlock: string;
  sources: string[];
  dataAsOf: string;
  hasData: boolean;
  /** Structured data the template fallback can use to give a targeted answer */
  parsedIntent: ParsedIntent;
}

interface ParsedIntent {
  type: 'status_check' | 'active_incidents' | 'history' | 'search' | 'analytics' | 'general';
  vendorId: string | null;
  vendorName: string | null;
  keywords: string[];
  searchResults: NormalisedIncident[];
  activeIncidents: NormalisedIncident[];
  recentIncidents: NormalisedIncident[];
}

// ── Keyword extraction ─────────────────────────────────────────────
// Strips common stop words and returns meaningful terms for searching
const STOP_WORDS = new Set([
  'is', 'are', 'was', 'were', 'the', 'a', 'an', 'any', 'this', 'that',
  'there', 'here', 'how', 'what', 'which', 'who', 'when', 'where', 'why',
  'do', 'does', 'did', 'has', 'have', 'had', 'be', 'been', 'being',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about',
  'up', 'out', 'if', 'or', 'and', 'but', 'not', 'no', 'so', 'it',
  'its', 'my', 'me', 'our', 'your', 'i', 'you', 'we', 'they', 'he',
  'she', 'tell', 'show', 'give', 'get', 'know', 'check', 'please',
  'right', 'now', 'currently', 'today', 'hi', 'hello', 'hey', 'nexus',
  'related', 'regarding', 'concerning', 'vendors', 'vendor', 'service',
  'services', 'status', 'going', 'everything', 'anything', 'something',
  'okay', 'ok', 'fine', 'good', 'bad', 'all', 'many', 'much', 'some',
  'just', 'only', 'also', 'more', 'most', 'very', 'really', 'quite',
  'still', 'already', 'yet', 'ever', 'never', 'always', 'often',
  'happening', 'happened', 'looking', 'need', 'want', 'like',
]);

function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[?!.,;:'"()]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// ── Intent classification ──────────────────────────────────────────
function classifyIntent(q: string): ParsedIntent['type'] {
  if (/\b(how many|average|mttr|mean time|trend|frequent|reliable|worst|best|analyt)/i.test(q)) return 'analytics';
  if (/\b(active|current|right now|ongoing|outage|down|issue|problem|broken|experiencing)/i.test(q)) return 'active_incidents';
  if (/\b(last|recent|history|past|previous|week|month|yesterday|incident)/i.test(q)) return 'history';
  if (/\b(search|find|related|about|involving|mention|affect)/i.test(q)) return 'search';
  if (/\b(up|working|operational|ok|okay|fine|running|healthy|alive)/i.test(q)) return 'status_check';
  return 'general';
}

// ── Format an incident for display ────────────────────────────────
function fmtIncident(i: NormalisedIncident, verbose = false): string {
  const impact = `[${i.impact.toUpperCase()}]`;
  const age = (() => { try { return formatDistanceToNow(parseISO(i.startedAt)); } catch { return 'unknown time'; } })();
  const resolved = i.resolvedAt
    ? `resolved ${(() => { try { return formatDistanceToNow(parseISO(i.resolvedAt)); } catch { return '?'; } })()} ago`
    : 'ONGOING';
  const dur = i.durationMinutes ? ` (${i.durationMinutes}min)` : '';
  let line = `- ${impact} ${i.vendorName}: "${i.name}" — ${resolved}${dur}`;
  if (verbose && i.latestUpdate) {
    line += `\n  Latest update: ${i.latestUpdate.slice(0, 400)}`;
  }
  return line;
}

// ── Main builder ──────────────────────────────────────────────────
export function buildBotContext(question: string, cache: IncidentCache): BotContext {
  const q = question.toLowerCase();
  const sources: string[] = [];
  const blocks: string[] = [];
  const now = new Date().toISOString();

  // ── 1. Parse intent
  const intentType = classifyIntent(q);
  const mentionedVendor = findVendorByName(question);
  const keywords = extractKeywords(question);

  // ── 2. Always include compact live status
  const liveStatuses = getAllLiveStatuses(cache);
  if (liveStatuses.length > 0) {
    sources.push('live_status');
    const statusLines = liveStatuses.map((s) => {
      const emoji = s.status === 'operational' ? '🟢' : s.status === 'degraded' ? '🟡' : s.status === 'outage' ? '🔴' : '⚪';
      const active = s.activeIncidents.length > 0
        ? ` — ${s.activeIncidents.length} active incident(s): ${s.activeIncidents.map((i) => i.name).join(', ')}`
        : '';
      const age = (() => { try { return formatDistanceToNow(parseISO(s.lastFetchedAt)); } catch { return '<1 min'; } })();
      return `${emoji} ${s.vendorName}: ${s.status}${active} (as of ${age} ago)`;
    });
    blocks.push(`## CURRENT LIVE STATUS\n${statusLines.join('\n')}`);
  }

  // ── 3. Always include active incidents (they're essential context)
  const allActive = mentionedVendor
    ? cache[mentionedVendor.id]?.liveStatus.activeIncidents ?? []
    : getAllActiveIncidents(cache);
  sources.push('active_incidents');
  if (allActive.length > 0) {
    blocks.push(`## ACTIVE INCIDENTS\n${allActive.map((i) => fmtIncident(i, true)).join('\n')}`);
  } else {
    blocks.push(`## ACTIVE INCIDENTS\nNo active incidents${mentionedVendor ? ` for ${mentionedVendor.displayName}` : ' across any vendor'}.`);
  }

  // ── 4. KEYWORD SEARCH — the core improvement
  //    Always run a search for non-trivial keywords that might appear inside
  //    incident names/descriptions even if the vendor isn't directly monitored
  //    (e.g., "AWS" appears in Snowflake incidents)
  const INTENT_WORDS = new Set([
    'outage', 'incident', 'incidents', 'down', 'active', 'operational',
    'working', 'degraded', 'issue', 'issues', 'problem', 'problems',
    'broken', 'experiencing', 'current', 'ongoing', 'recent', 'last',
    'history', 'past', 'previous', 'week', 'month', 'yesterday',
    'analytics', 'average', 'trend', 'worst', 'best', 'reliable',
    'search', 'find', 'update', 'updates', 'healthy', 'alive',
  ]);
  const searchTerms = keywords.filter((kw) => !INTENT_WORDS.has(kw));
  let searchResults: NormalisedIncident[] = [];
  if (searchTerms.length > 0) {
    // Search each keyword and merge results
    const seen = new Set<string>();
    for (const term of searchTerms) {
      const found = searchIncidents(cache, term);
      for (const inc of found) {
        if (!seen.has(inc.id)) {
          seen.add(inc.id);
          searchResults.push(inc);
        }
      }
    }
    if (searchResults.length > 0) {
      sources.push('keyword_search');
      const top = searchResults.slice(0, 15);
      blocks.push(`## KEYWORD SEARCH RESULTS (matching: ${searchTerms.join(', ')})\n${top.map((i) => fmtIncident(i, true)).join('\n')}`);
    }
  }

  // ── 5. Recent history (when explicitly requested or vendor-specific)
  if (intentType === 'history' || mentionedVendor) {
    const vendorId = mentionedVendor?.id ?? null;
    const recent = getRecentIncidents(cache, vendorId, 20);
    sources.push('incident_history');
    if (recent.length > 0) {
      blocks.push(`## RECENT INCIDENTS${mentionedVendor ? ` for ${mentionedVendor.displayName}` : ''} (last 20)\n${recent.map((i) => fmtIncident(i)).join('\n')}`);
    } else {
      blocks.push(`## RECENT INCIDENTS\nNo historical incidents found${mentionedVendor ? ` for ${mentionedVendor.displayName}` : ''}.`);
    }
  }

  // ── 6. Analytics
  if (intentType === 'analytics') {
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

  const hasData = liveStatuses.length > 0 || blocks.length > 1;
  const recentIncidents = intentType === 'history' || mentionedVendor
    ? getRecentIncidents(cache, mentionedVendor?.id ?? null, 20)
    : [];

  return {
    dataBlock: blocks.join('\n\n'),
    sources: [...new Set(sources)],
    dataAsOf: now,
    hasData,
    parsedIntent: {
      type: intentType,
      vendorId: mentionedVendor?.id ?? null,
      vendorName: mentionedVendor?.displayName ?? null,
      keywords: searchTerms,
      searchResults,
      activeIncidents: allActive,
      recentIncidents,
    },
  };
}
