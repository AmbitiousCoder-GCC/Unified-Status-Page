import { GoogleGenerativeAI } from "@google/generative-ai";
import { getIncidents } from "@/lib/db/queries";
import { validateChatInput } from "@/lib/validation/chat";
import { logChatInteraction } from "@/lib/utils/logger";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Using 1.5 Pro as 2.5 is not officially out yet, but can be updated

interface ChatContext {
    incidents: any[];
    vendorStatuses: Map<string, string>;
    systemPrompt: string;
}

const SYSTEM_PROMPT = `You are an intelligent incident analysis assistant for a production status monitoring system.
You have access to:
1. Real-time vendor status data (updated every 60 seconds)
2. Incident history for the past 15 days
3. Cross-vendor dependency information

When responding to user queries:
- Analyze patterns in incident data (e.g., "AWS had 3 outages this week")
- Identify correlations between vendor failures (e.g., "When GitHub went down, CI/CD failed")
- Predict cascading impact (e.g., "If Snowflake goes down, analytics pipelines will fail")
- Provide actionable recommendations based on incident history

IMPORTANT:
- Always cite specific incident data or timestamps
- If you don't have specific data, explicitly say so
- Distinguish between correlation and causation
- Consider business impact, not just technical details
- Be concise but thorough in analysis`;

/**
 * Builds the context for the AI by fetching real data from the database.
 */
async function buildChatContext(): Promise<ChatContext> {
    // Fetch recent incidents
    const incidents = await getIncidents({
        limit: 100,
        offset: 0
    });

    // Map vendor statuses
    const vendorStatuses = new Map<string, string>();
    incidents.forEach(incident => {
        if (incident.vendor_id && incident.status) {
            vendorStatuses.set(incident.vendor_id, incident.status);
        }
    });

    return {
        incidents,
        vendorStatuses,
        systemPrompt: SYSTEM_PROMPT,
    };
}

/**
 * Analyzes a user message using Gemini and provides a contextual response.
 */
export async function analyzeChat(
    userMessage: string,
    conversationHistory: any[] = []
): Promise<string> {
    // 1. Validate input
    const validated = validateChatInput({ message: userMessage });
    if (!validated.success) {
        throw new Error(`Invalid input: ${JSON.stringify(validated.error.flatten())}`);
    }

    // 2. Build context with real data
    const context = await buildChatContext();

    // 3. Format current status for context
    const currentStatusText = Array.from(context.vendorStatuses.entries())
        .map(([vendor, status]) => `- ${vendor}: ${status}`)
        .join('\n');

    // 4. Format recent incidents for context
    const incidentsText = context.incidents
        .slice(0, 20)
        .map(i => `- ${i.vendor_id} (${i.status}): ${i.name} (${i.created_at})`)
        .join('\n');

    // 5. Build the full message with context
    const contextualMessage = `
CURRENT VENDOR STATUS:
${currentStatusText}

RECENT INCIDENTS (Last 15 days):
${incidentsText}

---
USER QUESTION: ${validated.data.message}`;

    // 6. Build conversation history for the model
    const history = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
    }));

    // Add the current message
    history.push({
        role: 'user',
        parts: [{ text: contextualMessage }],
    });

    // 7. Call Gemini with system prompt and tuned parameters
    try {
        const chat = model.startChat({
            history: history.slice(0, -1), // History excluding current message
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 1024,
            },
        });

        const result = await chat.sendMessage(contextualMessage);
        const responseText = result.response.text();

        // 8. Log interaction for audit trail
        await logChatInteraction(
            'unknown-ip', // Overridden in route handler if possible
            validated.data.message,
            responseText,
            {
                vendorCount: context.vendorStatuses.size,
                incidentCount: context.incidents.length,
            }
        );

        return responseText;
    } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error('Failed to generate AI response');
    }
}
