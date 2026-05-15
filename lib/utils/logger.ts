import { logAuditEvent } from "@/lib/db/queries";

export interface AuditLogEntry {
    action: string;
    userIp: string;
    userMessage?: string;
    response?: string;
    context?: Record<string, any>;
}

/**
 * Logs a chat interaction for auditing and analytics.
 */
export async function logChatInteraction(
    userIp: string,
    userMessage: string,
    response: string,
    context?: any
): Promise<void> {
    try {
        await logAuditEvent("CHAT_INTERACTION", userIp, {
            userMessage: maskSensitiveData(userMessage),
            response: maskSensitiveData(response),
            ...context
        });
    } catch (error) {
        console.error("Failed to log chat interaction:", error);
    }
}

/**
 * Masks sensitive data like API keys, tokens, and passwords in logs.
 */
export function maskSensitiveData(data: string): string {
    if (!data) return data;
    
    // Simple patterns for common sensitive data
    const patterns = [
        /(key|token|password|secret)=([^&\s]+)/gi,
        /(Bearer\s+)([a-zA-Z0-9-._~+/]+=*)/gi
    ];
    
    let sanitized = data;
    patterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, "$1=********");
    });
    
    return sanitized;
}
