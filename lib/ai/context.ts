import { getRecentIncidentsForChat, getCurrentVendorStatuses } from "./queries";
import { formatStatusForContext, formatIncidentsForContext } from "./helpers";
import type { ChatContext } from "./types";

/**
 * Builds the full data context that gets injected into every Gemini prompt.
 *
 * This is the critical bridge between the database and the AI model.
 * It fetches real data — current vendor statuses and the last 15 days of
 * incidents — and formats them into human-readable text blocks that Gemini
 * can reason over.
 *
 * Design decisions:
 * - Fetches happen in parallel (Promise.all) to minimise latency.
 * - Failures degrade gracefully: if one query fails, the other's data
 *   is still included so the chatbot can give a partial answer.
 * - The formatted strings are kept compact to stay within Gemini's
 *   context window budget.
 */
export async function buildChatContext(): Promise<ChatContext> {
  const [statuses, incidents] = await Promise.all([
    getCurrentVendorStatuses(),
    getRecentIncidentsForChat(100),
  ]);

  return {
    currentStatus: formatStatusForContext(statuses),
    recentIncidents: formatIncidentsForContext(incidents),
    vendorCount: statuses.length,
    incidentCount: incidents.length,
  };
}
