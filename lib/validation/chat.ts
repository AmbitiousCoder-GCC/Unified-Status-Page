import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

/**
 * Schema for chat message input.
 * Sanitizes the message content to prevent XSS.
 */
export const ChatMessageSchema = z.object({
    message: z
        .string()
        .min(1, "Message cannot be empty")
        .max(2000, "Message too long")
        .transform(msg => DOMPurify.sanitize(msg)),
    conversationId: z.string().uuid().optional(),
});

/**
 * Schema for incident filtering.
 * Ensures valid status enums and numeric ranges.
 */
export const IncidentFiltersSchema = z.object({
    vendor_id: z.string().optional(),
    status: z.enum(['OPERATIONAL', 'DEGRADED', 'OUTAGE']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
});

/**
 * Validates chat input data.
 */
export function validateChatInput(data: unknown) {
    return ChatMessageSchema.safeParse(data);
}

/**
 * Validates incident filter data.
 */
export function validateIncidentFilters(data: unknown) {
    return IncidentFiltersSchema.safeParse(data);
}
