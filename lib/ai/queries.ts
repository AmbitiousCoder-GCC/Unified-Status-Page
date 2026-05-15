import { sql } from "@vercel/postgres";
import type { Incident } from "@/types";

/**
 * Fetches recent incidents from the database for chat context injection.
 *
 * Why a dedicated function instead of reusing getIncidents()?
 * The generic getIncidents() is designed for the incidents API and UI filters.
 * This function is optimised for the chatbot: it only selects columns needed
 * for context, always orders newest-first, and silently returns an empty array
 * on failure instead of throwing — because a chatbot context miss should degrade
 * gracefully, not crash the conversation.
 */
export async function getRecentIncidentsForChat(limit: number = 100): Promise<Incident[]> {
  try {
    const { rows } = await sql`
      SELECT id, vendor_id, name, status, impact, description, created_at, updated_at
      FROM incidents
      WHERE created_at >= CURRENT_DATE - INTERVAL '15 days'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as Incident[];
  } catch (error) {
    console.error("[Chat] Failed to fetch recent incidents:", error);
    return [];
  }
}

/**
 * Fetches the current status snapshot for every vendor.
 *
 * Returns an empty array on failure so the chatbot can still operate
 * (with reduced context) rather than failing entirely.
 */
export async function getCurrentVendorStatuses(): Promise<
  Array<{ vendor_id: string; vendor_name: string; status: string; description: string | null; last_checked: Date }>
> {
  try {
    const { rows } = await sql`
      SELECT
        vs.vendor_id,
        v.name AS vendor_name,
        vs.status,
        vs.description,
        vs.last_checked
      FROM vendor_status vs
      JOIN vendors v ON v.id = vs.vendor_id
      ORDER BY v.name ASC
    `;
    return rows as Array<{
      vendor_id: string;
      vendor_name: string;
      status: string;
      description: string | null;
      last_checked: Date;
    }>;
  } catch (error) {
    console.error("[Chat] Failed to fetch vendor statuses:", error);
    return [];
  }
}
