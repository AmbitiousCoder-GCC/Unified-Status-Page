/**
 * Core type definitions for the Unified Status Page.
 */

export interface Vendor {
    id: string;
    name: string;
    status_page_url: string;
    created_at: Date;
}

export type StatusLevel = "OPERATIONAL" | "DEGRADED" | "OUTAGE";

export interface VendorStatus {
    vendor_id: string;
    status: StatusLevel;
    description: string;
    lastChecked: Date;
    incidents: Incident[];
}

export interface Incident {
    id: string;
    vendor_id: string;
    name: string;
    status: string;
    impact?: string;
    description?: string;
    created_at: Date;
    updated_at: Date;
}

export interface ChatMessage {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    created_at: Date;
}

export interface ChatConversation {
    id: string;
    userId?: string;
    created_at: Date;
    updated_at: Date;
}

export interface AuditLog {
    id: string;
    action: string;
    userIp: string;
    userMessage?: string;
    response?: string;
    context_json?: Record<string, any>;
    created_at: Date;
}
