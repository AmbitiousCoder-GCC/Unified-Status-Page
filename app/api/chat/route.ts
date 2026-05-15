import { NextRequest, NextResponse } from "next/server";
import { analyzeChat } from "@/lib/ai/chat";
import { extractClientIp, checkChatRateLimit } from "@/lib/security/api";
import { validateChatMessage } from "@/lib/ai/helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/chat
 *
 * Production-grade chat endpoint with:
 * - Upstash Redis rate limiting (10 req/min per IP)
 * - DOMPurify input sanitisation
 * - Real-time vendor context injection via Gemini 2.5 Pro
 * - Conversation history support for multi-turn analysis
 * - Audit logging of all interactions
 *
 * Request body:
 * {
 *   "message": string,                           // required, 1-2000 chars
 *   "conversationHistory"?: Array<{role, content}> // optional, last N messages
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "response": "AI analysis...",
 *   "timestamp": "ISO-8601"
 * }
 *
 * Error responses: 400, 429, 500
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = extractClientIp(request);

  // ------------------------------------------------------------------
  // 1. RATE LIMITING — fail closed (reject if uncertain)
  // ------------------------------------------------------------------
  try {
    const isAllowed = await checkChatRateLimit(request);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  } catch (rateLimitError) {
    // Fail closed: if we can't verify the rate limit, reject the request.
    console.error("[Chat] Rate limit check failed:", rateLimitError);
    return NextResponse.json(
      { success: false, error: "Service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  // ------------------------------------------------------------------
  // 2. PARSE REQUEST BODY
  // ------------------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  // ------------------------------------------------------------------
  // 3. VALIDATE MESSAGE INPUT
  // ------------------------------------------------------------------
  const { message, conversationHistory } = body as Record<string, unknown>;
  // Also accept `question` field for backward compatibility with the old /api/bot route
  const rawMessage = message ?? (body as Record<string, unknown>).question;

  const validated = validateChatMessage(rawMessage);
  if (!validated.success || !validated.data) {
    return NextResponse.json(
      { success: false, error: validated.error ?? "Invalid message" },
      { status: 400 }
    );
  }

  // Validate conversation history if provided
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (Array.isArray(conversationHistory)) {
    history = conversationHistory
      .filter(
        (msg): msg is { role: string; content: string } =>
          typeof msg === "object" &&
          msg !== null &&
          typeof (msg as Record<string, unknown>).role === "string" &&
          typeof (msg as Record<string, unknown>).content === "string"
      )
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-20) // cap at 20 messages
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content.slice(0, 2000), // truncate long history messages
      }));
  }

  // ------------------------------------------------------------------
  // 4. CALL THE AI CHATBOT
  // ------------------------------------------------------------------
  try {
    const response = await analyzeChat(validated.data, history, clientIp);

    return NextResponse.json({
      success: true,
      response,
      // Fields for backward compatibility with the old BotResponse shape
      answer: response,
      confidence: "high",
      sources: [],
      suggestedQueries: [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Chat] Analysis failed:", error);

    // Never expose internal error details to the client.
    return NextResponse.json(
      { success: false, error: "An error occurred while analyzing your question. Please try again." },
      { status: 500 }
    );
  }
}
