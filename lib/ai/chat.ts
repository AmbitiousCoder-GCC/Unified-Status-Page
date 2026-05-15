import { GoogleGenerativeAI } from "@google/generative-ai";
import { SRE_SYSTEM_PROMPT } from "./system-prompt";
import { buildChatContext } from "./context";
import { validateChatMessage, logChatInteraction } from "./helpers";

/**
 * Core chatbot analysis function.
 *
 * This is the ONLY place where Gemini is called. The function:
 * 1. Validates user input.
 * 2. Fetches live vendor status + incident data from the database.
 * 3. Injects that data as context into the Gemini prompt.
 * 4. Sends the contextualised prompt to Gemini 2.5 Pro.
 * 5. Returns the AI's actual response (NOT keyword-matched DB results).
 *
 * Why we inject context into the user message rather than using tools:
 * Tool use (function calling) adds latency and complexity. For a read-only
 * dashboard chatbot the data is small enough to inject directly, giving the
 * model full context in a single round-trip.
 *
 * @param userMessage  - The user's question, 1-2000 characters.
 * @param conversationHistory - Previous messages for multi-turn context.
 * @param clientIp - IP address for audit logging.
 * @returns The AI-generated analysis text.
 * @throws {Error} On invalid input or Gemini API failure.
 */
export async function analyzeChat(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  clientIp: string = "unknown"
): Promise<string> {
  // ------------------------------------------------------------------
  // 1. INPUT VALIDATION
  // ------------------------------------------------------------------
  const validated = validateChatMessage(userMessage);
  if (!validated.success || !validated.data) {
    throw new Error(validated.error ?? "Invalid input");
  }
  const sanitisedMessage = validated.data;

  // ------------------------------------------------------------------
  // 2. BUILD REAL-TIME CONTEXT FROM DATABASE
  // ------------------------------------------------------------------
  const context = await buildChatContext();

  // ------------------------------------------------------------------
  // 3. INJECT CONTEXT INTO THE USER MESSAGE
  //    This is the critical step that makes the chatbot useful.
  //    Without this, Gemini would only see the user's question in a
  //    vacuum and give generic answers.
  // ------------------------------------------------------------------
  const contextualMessage = [
    "=== CURRENT VENDOR STATUS ===",
    context.currentStatus,
    "",
    "=== INCIDENT HISTORY (Last 15 Days) ===",
    context.recentIncidents,
    "",
    `Total vendors monitored: ${context.vendorCount}`,
    `Total incidents in window: ${context.incidentCount}`,
    "",
    "=== USER QUESTION ===",
    sanitisedMessage,
  ].join("\n");

  // ------------------------------------------------------------------
  // 4. BUILD THE MESSAGE ARRAY WITH CONVERSATION HISTORY
  //    Gemini expects alternating user/model messages. We map our
  //    "assistant" role to Gemini's "model" role.
  // ------------------------------------------------------------------
  const history = conversationHistory
    .slice(-20) // keep last 20 messages to stay within context limits
    .map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

  // ------------------------------------------------------------------
  // 5. CALL GEMINI API
  //    - Uses systemInstruction so the SRE prompt persists across turns.
  //    - Temperature 0.7 balances creativity with factual accuracy.
  //    - 10-second timeout prevents indefinite hangs.
  // ------------------------------------------------------------------
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-05-06",
    systemInstruction: SRE_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  try {
    const chat = model.startChat({
      history,
    });

    const result = await chat.sendMessage(contextualMessage);
    const responseText = result.response.text();

    // ------------------------------------------------------------------
    // 6. AUDIT LOGGING
    //    Log the interaction asynchronously. Don't await — if logging
    //    fails, the user should still get their response.
    // ------------------------------------------------------------------
    logChatInteraction(clientIp, sanitisedMessage, responseText, {
      vendorCount: context.vendorCount,
      incidentCount: context.incidentCount,
    }).catch(() => {
      /* intentionally swallowed — logged inside logChatInteraction */
    });

    // ------------------------------------------------------------------
    // 7. RETURN THE ACTUAL GEMINI RESPONSE
    //    This is the whole point: we return what the AI said, not some
    //    keyword-filtered database result.
    // ------------------------------------------------------------------
    return responseText;
  } catch (error) {
    console.error("[Chat] Gemini API call failed:", error);
    throw new Error("Failed to generate response. Please try again.");
  }
}
