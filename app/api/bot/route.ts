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

const SYSTEM_PROMPT = `You are Nexus, a friendly and knowledgeable status assistant for the Nexus Status Grid dashboard.
Your job is to help users understand the health of these 11 services: ${KNOWN_VENDOR_NAMES}.

## Your Personality
- Warm, helpful, and conversational — like a knowledgeable colleague, not a robot
- Proactively reassure users when things look good; be empathetic when there are issues
- Use plain English. Avoid jargon and raw data dumps
- Keep answers focused and scannable — use short paragraphs or a brief list when there are multiple items
- End with a helpful follow-up suggestion when appropriate (e.g. "Want me to check historical incidents for Snowflake?")

## How to Respond

**When everything is fine:** Lead with good news. E.g. "Good news — GitHub is fully operational right now with no active incidents."

**When there's an outage or incident:** Be clear and empathetic. Summarise what's happening, which systems are affected, how long it's been going on, and the vendor's latest update in plain English. Don't just copy raw text.

**For history / analytics:** Summarise the key takeaway first, then back it up with specific details. E.g. "Snowflake has had 3 incidents in the past month, the most recent lasting about 2 hours."

**For unknown vendors:** "That service isn't in our monitoring list. I keep an eye on: GitHub, GitLab, MongoDB, Google Cloud, Auth0, Databricks, Cloudflare, Azure, Snowflake, SailPoint, and Cycode."

## Hard Rules (never break these)
- Only use facts from the DATA CONTEXT provided. Never invent incidents, times, or statuses.
- If the data context has no relevant info, say so honestly and naturally: "I don't have current data on that — it might be outside the range I've loaded, or the vendor hasn't reported it officially."
- Never make up incident IDs or vendor quotes.
- All times are UTC. When mentioning durations, use human-friendly phrasing like "about 2 hours ago" or "started 3 days ago".`;

async function generateWithGemini(
  systemPrompt: string,
  dataContext: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set');

  const { google } = await import('@ai-sdk/google');
  const { generateText } = await import('ai');

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user' as const,
      content: `Here is the current vendor status data:\n\n${dataContext}\n\n---\nUser question: ${question}`,
    },
  ];

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages,
    maxTokens: 1000,
    temperature: 0.4,
  });

  return text;
}

function templateAnswer(hasData: boolean, dataContext: string): string {
  if (!hasData) {
    return "I don't have current status data loaded yet. This usually resolves in a few seconds — please try again shortly! 🔄";
  }
  const lines = dataContext
    .split('\n')
    .filter(
      (l) =>
        l.trim().startsWith('🟢') ||
        l.trim().startsWith('🟡') ||
        l.trim().startsWith('🔴')
    );
  if (lines.length === 0) {
    return "I have some status data but couldn't parse it cleanly. Try asking about a specific vendor like \"Is GitHub operational?\"";
  }
  const operational = lines.filter((l) => l.includes('🟢')).length;
  const degraded = lines.filter((l) => l.includes('🟡')).length;
  const outage = lines.filter((l) => l.includes('🔴')).length;

  let summary = `Here's a quick overview of the monitored services:\n\n`;
  if (outage > 0) summary += `🔴 ${outage} service(s) are currently experiencing an outage\n`;
  if (degraded > 0) summary += `🟡 ${degraded} service(s) are degraded\n`;
  if (operational > 0) summary += `🟢 ${operational} service(s) are fully operational\n`;
  summary += `\n${lines.join('\n')}`;
  return summary;
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
      answer = templateAnswer(hasData, dataBlock);
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
