/**
 * Chat-specific type definitions.
 *
 * These extend the core types in types/index.ts and types/bot.ts
 * with structures used exclusively by the chatbot subsystem.
 */

/** Structured context injected into every Gemini prompt. */
export interface ChatContext {
  currentStatus: string;
  recentIncidents: string;
  vendorCount: number;
  incidentCount: number;
}

/** Shape returned by the POST /api/chat endpoint. */
export interface ChatApiResponse {
  success: boolean;
  response: string;
  timestamp: string;
  conversationId?: string;
  confidence?: "high" | "medium" | "low";
  suggestedQueries?: string[];
}

/** Result of input validation. */
export interface ValidationResult {
  success: boolean;
  data?: string;
  error?: string;
}
