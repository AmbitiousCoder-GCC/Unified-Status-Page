import { NextRequest, NextResponse } from "next/server";
import { checkChatRateLimit, extractClientIp } from "@/lib/security/api";
import { analyzeChat } from "@/lib/ai/chat";
import { validateChatInput } from "@/lib/validation/chat";
import { logChatInteraction } from "@/lib/utils/logger";

/**
 * Chat endpoint for AI-powered incident analysis.
 * Implements rate limiting, input validation, and audit logging.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Extract client IP for rate limiting and logging
        const clientIp = extractClientIp(request);

        // 2. Check rate limit (10 req/min)
        const isAllowed = await checkChatRateLimit(request);
        if (!isAllowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a minute." },
                { status: 429, headers: { "Retry-After": "60" } }
            );
        }

        // 3. Parse and validate request body
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 }
            );
        }

        const validated = validateChatInput(body);
        if (!validated.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validated.error.flatten() },
                { status: 400 }
            );
        }

        // 4. Call AI analysis with context
        const response = await analyzeChat(validated.data.message);

        // 5. Final audit log with actual IP (already partially logged in analyzeChat but this ensures IP is correct)
        await logChatInteraction(clientIp, validated.data.message, response);

        // 6. Return response
        return NextResponse.json({
            success: true,
            response,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("Chat endpoint error:", error);
        
        // Don't expose internal error details in production
        return NextResponse.json(
            { error: "An internal error occurred while processing your request." },
            { status: 500 }
        );
    }
}
