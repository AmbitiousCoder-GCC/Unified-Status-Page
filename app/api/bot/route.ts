// app/api/bot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIncidentCache } from '@/lib/vendors/incidentStore';
import { buildBotContext } from '@/lib/vendors/botContext';
import { KNOWN_VENDOR_NAMES } from '@/lib/vendors/vendorRegistry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
  conversationHistory: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional()
    .default([]),
});

const SYSTEM_PROMPT = `You are the Vendor Status Intelligence Bot for Nexus Status Grid.
You answer questions about vendor uptime, outages, and incidents for these 11 services:
${KNOWN_VENDOR_NAMES}.

RULES — follow without exception:
1. ONLY use the DATA CONTEXT provided below. Never invent incidents or statuses.
2. If the data context does not contain the answer, say exactly:
   "I don't have that information in my current data. This may be outside the available data range, or the vendor hasn't reported it officially."
3. If asked about a vendor NOT in the list above, say:
   "That vendor is not monitored by this system."
4. For real-time questions, always state when the data was last fetched.
5. For analytics, state the data you used before giving the conclusion.
6. Never speculate beyond what the official vendor data says.
7. Be concise. Use bullet points for multi-item answers. All times in UTC.
8. Never make up incident IDs, timestamps, or vendor statements.`;

async function generateWithGemini(
  systemPrompt: string,
  dataContext: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { google } = await import('@ai-sdk/google');
  const { generateText } = await import('ai');

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user' as const,
      content: `DATA CONTEXT (use only this):\n${dataContext}\n\nQUESTION: ${question}`,
    },
  ];

  const { text } = await generateText({
    model: google('gemini-1.5-pro-latest'),
    system: systemPrompt,
    messages,
    maxTokens: 800,
    temperature: 0.1, // low temp → factual, grounded answers
  });

  return text;
}

function templateAnswer(question: string, dataContext: string, hasData: boolean): string {
  if (!hasData) {
    return "I don't have that information in my current data. The data may not have loaded yet — please try again in a moment.";
  }
  // Simple template fallback when no LLM key
  return `Here is the raw data for your question:\n\n${dataContext}\n\n*(AI analysis unavailable — GEMINI_API_KEY not configured)*`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { question, conversationHistory } = parsed.data;

  try {
    const cache = await getIncidentCache();
    const { dataBlock, sources, dataAsOf, hasData } = buildBotContext(question, cache);

    let answer: string;

    try {
      answer = await generateWithGemini(SYSTEM_PROMPT, dataBlock, question, conversationHistory);
    } catch (llmErr) {
      console.warn('[Bot] LLM unavailable, using template fallback:', llmErr);
      answer = templateAnswer(question, dataBlock, hasData);
    }

    return NextResponse.json({
      answer,
      sources,
      confidence: hasData ? 'high' : 'none',
      dataAsOf,
    });
  } catch (err) {
    console.error('[Bot] /api/bot critical error:', err);
    return NextResponse.json(
      { error: 'Bot service unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
