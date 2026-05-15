// types/bot.ts
// All types for the bot feature. Isolated from existing dashboard types.

export type VendorApiType = 'statuspage_v2' | 'statusio' | 'azure' | 'none';

export interface VendorConfig {
  id: string;              // matches existing dashboard vendor IDs exactly (see audit)
  displayName: string;
  statusPageUrl: string;
  apiType: VendorApiType;
  apiBaseUrl: string | null;
}

export type IncidentStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'postmortem'
  | 'unknown';

export type IncidentImpact = 'none' | 'minor' | 'major' | 'critical' | 'unknown';

export interface IncidentUpdate {
  body: string;
  createdAt: string; // ISO8601 UTC
  status: IncidentStatus;
}

export interface NormalisedIncident {
  id: string;              // "{vendorId}:{externalId}"
  vendorId: string;
  vendorName: string;
  externalId: string;
  name: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  startedAt: string;       // ISO8601 UTC
  resolvedAt: string | null;
  durationMinutes: number | null;
  latestUpdate: string;
  updates: IncidentUpdate[];
  source: 'vendor_api';
}

export interface VendorLiveStatus {
  vendorId: string;
  vendorName: string;
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  activeIncidents: NormalisedIncident[];
  lastFetchedAt: string;   // ISO8601 UTC
}

export interface IncidentCache {
  [vendorId: string]: {
    liveStatus: VendorLiveStatus;
    recentIncidents: NormalisedIncident[];  // last 50, newest first
    fetchedAt: number;                      // Date.now() timestamp
  };
}

export interface BotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  suggestedQueries?: string[];
}

export interface BotRequest {
  question: string;
  conversationHistory?: BotMessage[];
}

export interface BotResponse {
  answer: string;
  sources: string[];       // which vendors/endpoints were queried
  confidence: 'high' | 'medium' | 'low' | 'none';
  dataAsOf?: string;        // ISO8601 UTC of the data used
  suggestedQueries?: string[];
  detectedIntent?: string;
}
