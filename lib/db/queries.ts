import { sql } from "@vercel/postgres";
import { Vendor, Incident, ChatMessage, VendorStatus } from "@/types";

/**
 * Fetches all vendors from the database.
 */
export async function getVendors(): Promise<Vendor[]> {
    try {
        const { rows } = await sql<Vendor>`SELECT * FROM vendors ORDER BY name ASC`;
        return rows;
    } catch (error) {
        console.error("Failed to fetch vendors:", error);
        throw new Error("Database query failed: getVendors");
    }
}

/**
 * Fetches incidents based on filters.
 * Uses parameterized queries to prevent SQL injection.
 */
export async function getIncidents(filters: { 
    vendor_id?: string; 
    status?: string; 
    limit: number; 
    offset: number 
}): Promise<Incident[]> {
    try {
        let query = "SELECT * FROM incidents WHERE 1=1";
        const values: any[] = [];
        let paramCount = 1;

        if (filters.vendor_id) {
            query += ` AND vendor_id = $${paramCount++}`;
            values.push(filters.vendor_id);
        }

        if (filters.status) {
            query += ` AND status = $${paramCount++}`;
            values.push(filters.status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        values.push(filters.limit, filters.offset);

        // Note: Using raw sql for dynamic building but with parameterized values
        const { rows } = await sql.query(query, values);
        return rows as Incident[];
    } catch (error) {
        console.error("Failed to fetch incidents:", error);
        throw new Error("Database query failed: getIncidents");
    }
}

/**
 * Updates a vendor's status and logs associated incidents.
 * Performs operations within a transaction-like approach (manual due to simple sql helper).
 */
export async function updateVendorStatus(
    vendorId: string, 
    status: string, 
    description: string, 
    incidents: any[]
): Promise<void> {
    try {
        // Update vendor status
        await sql`
            INSERT INTO vendor_status (vendor_id, status, description, last_checked, updated_at)
            VALUES (${vendorId}, ${status}, ${description}, NOW(), NOW())
            ON CONFLICT (vendor_id) DO UPDATE SET
                status = EXCLUDED.status,
                description = EXCLUDED.description,
                last_checked = EXCLUDED.last_checked,
                updated_at = EXCLUDED.updated_at
        `;

        // Upsert incidents
        for (const incident of incidents) {
            await sql`
                INSERT INTO incidents (id, vendor_id, name, status, impact, description, created_at, updated_at)
                VALUES (
                    ${incident.id}, 
                    ${vendorId}, 
                    ${incident.name}, 
                    ${incident.status}, 
                    ${incident.impact}, 
                    ${incident.description}, 
                    ${incident.created_at}, 
                    ${incident.updated_at}
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    impact = EXCLUDED.impact,
                    description = EXCLUDED.description,
                    updated_at = EXCLUDED.updated_at
            `;
        }
    } catch (error) {
        console.error(`Failed to update status for vendor ${vendorId}:`, error);
        throw new Error("Database query failed: updateVendorStatus");
    }
}

/**
 * Creates a new chat conversation session.
 */
export async function createChatConversation(userId?: string): Promise<string> {
    try {
        const { rows } = await sql`
            INSERT INTO chat_conversations (user_id)
            VALUES (${userId || null})
            RETURNING id
        `;
        return rows[0].id;
    } catch (error) {
        console.error("Failed to create chat conversation:", error);
        throw new Error("Database query failed: createChatConversation");
    }
}

/**
 * Adds a message to a chat conversation.
 */
export async function addChatMessage(
    conversationId: string, 
    role: 'user' | 'assistant', 
    content: string
): Promise<void> {
    try {
        await sql`
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES (${conversationId}, ${role}, ${content})
        `;
        // Update conversation's updated_at
        await sql`
            UPDATE chat_conversations SET updated_at = NOW() WHERE id = ${conversationId}
        `;
    } catch (error) {
        console.error("Failed to add chat message:", error);
        throw new Error("Database query failed: addChatMessage");
    }
}

/**
 * Logs an event for auditing purposes.
 */
export async function logAuditEvent(
    action: string, 
    userIp: string, 
    details: any
): Promise<void> {
    try {
        const { userMessage, response, ...context } = details;
        await sql`
            INSERT INTO audit_logs (action, user_ip, user_message, response, context_json)
            VALUES (${action}, ${userIp}, ${userMessage || null}, ${response || null}, ${JSON.stringify(context)})
        `;
    } catch (error) {
        // Log to console but don't crash the app if audit logging fails
        console.error("Failed to log audit event:", error);
    }
}

/**
 * Retrieves message history for a conversation.
 */
export async function getChatHistory(conversationId: string): Promise<ChatMessage[]> {
    try {
        const { rows } = await sql<ChatMessage>`
            SELECT * FROM chat_messages 
            WHERE conversation_id = ${conversationId} 
            ORDER BY created_at ASC
        `;
        return rows;
    } catch (error) {
        console.error("Failed to fetch chat history:", error);
        throw new Error("Database query failed: getChatHistory");
    }
}
