import DOMPurify from "isomorphic-dompurify";
import type { Incident } from "@/types";
import type { ValidationResult } from "./types";
import { logAuditEvent } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

/**
 * Validates and sanitises a raw chat message.
 *
 * Why DOMPurify instead of a simple regex?
 * Regex-based sanitisation is fragile against unicode tricks and nested
 * encoding. DOMPurify is battle-tested against real XSS payloads.
 *
 * @param message - The raw user input (may be any type at runtime).
 * @returns A ValidationResult with the sanitised string or an error message.
 */
export function validateChatMessage(message: unknown): ValidationResult {
  if (typeof message !== "string") {
    return { success: false, error: "Message must be a string" };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { success: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > 2000) {
    return { success: false, error: "Message must be 2000 characters or fewer" };
  }

  const sanitised = DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });

  if (sanitised.length === 0) {
    return { success: false, error: "Message contained only disallowed content" };
  }

  return { success: true, data: sanitised };
}

// ---------------------------------------------------------------------------
// Context Formatting
// ---------------------------------------------------------------------------

/**
 * Formats vendor status rows into a human-readable block for Gemini context.
 *
 * Example output line:
 *   GitHub: OPERATIONAL — All Systems Operational
 */
export function formatStatusForContext(
  statuses: Array<{ vendor_name: string; status: string; description: string | null }>
): string {
  if (statuses.length === 0) return "No vendor status data available.";

  return statuses
    .map((s) => `${s.vendor_name}: ${s.status} — ${s.description ?? "No description"}`)
    .join("\n");
}

/**
 * Formats incident rows into a timestamped log for Gemini context.
 *
 * Example output line:
 *   [2025-05-14 03:22 UTC] GitHub: Actions degraded performance (investigating)
 */
export function formatIncidentsForContext(incidents: Incident[]): string {
  if (incidents.length === 0) return "No incidents recorded in the last 15 days.";

  return incidents
    .slice(0, 30) // cap to keep prompt size manageable
    .map((i) => {
      const ts = new Date(i.created_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
      return `[${ts}] ${i.vendor_id}: ${i.name} (${i.status})`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Audit Logging
// ---------------------------------------------------------------------------

/**
 * Logs a chat interaction for audit trail and analytics.
 *
 * Truncates the AI response to 500 chars to avoid bloating the audit table,
 * and wraps in try/catch so a logging failure never breaks a user conversation.
 */
export async function logChatInteraction(
  userIp: string,
  userMessage: string,
  response: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await logAuditEvent("CHAT_ANALYSIS", userIp, {
      userMessage: userMessage.slice(0, 500),
      response: response.slice(0, 500),
      ...context,
    });
  } catch (error) {
    // Audit logging must never crash the conversation flow.
    console.error("[Chat] Audit log failed:", error);
  }
}
