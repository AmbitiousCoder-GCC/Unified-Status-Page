// app/api/bot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIncidentCache } from '@/lib/vendors/incidentStore';
import { buildBotContext, type BotContext } from '@/lib/vendors/botContext';
import { KNOWN_VENDOR_NAMES } from '@/lib/vendors/vendorRegistry';
import { formatDistanceToNow, parseISO } from 'date-fns';

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
- Proactively reassure when things look good; be empathetic when there are issues
- Use plain English. Avoid jargon and raw data dumps
- Keep answers focused and scannable
- End with a helpful follow-up suggestion when appropriate

## How to Respond
- **Status checks:** Lead with good/bad news clearly. "Good news — GitHub is fully operational."
- **Outages/incidents:** Summarise what's happening, affected systems, duration, latest update — in plain English.
- **Keyword searches (e.g. "AWS outage"):** Focus your answer on the matching incidents. Don't dump unrelated data. If a user asks about "AWS", show only incidents whose name or description mentions AWS.
- **History/analytics:** Summarise the key takeaway first, then specific details.
- **Unknown vendors:** "That service isn't in our monitoring list. We monitor: ${KNOWN_VENDOR_NAMES}."

## Hard Rules
- Only use facts from the DATA CONTEXT. Never invent incidents, times, or statuses.
- If no relevant data exists, say so honestly and naturally.
- Never make up incident IDs or vendor quotes.
- Use human-friendly time phrasing ("about 2 hours ago", "started 3 days ago").
- IMPORTANT: If the data contains a KEYWORD SEARCH RESULTS section, that is the most relevant data for the user's question. Focus your answer on those results.`;

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

// ── Smart template fallback — uses parsed intent for targeted answers ──
function templateAnswer(ctx: BotContext, question: string): string {
  const { parsedIntent: pi, hasData } = ctx;

  if (!hasData) {
    return "I don't have current status data loaded yet. This usually resolves in a few seconds — please try again shortly! 🔄";
  }

  // 1. If asking about a SPECIFIC monitored vendor → answer their status directly
  if (pi.vendorName && (pi.type === 'active_incidents' || pi.type === 'status_check' || pi.type === 'general')) {
    if (pi.activeIncidents.length === 0) {
      return `✅ Good news — ${pi.vendorName} is fully operational right now with no active incidents.`;
    }
    const lines = pi.activeIncidents.slice(0, 6).map((i) => {
      const age = (() => { try { return formatDistanceToNow(parseISO(i.startedAt)); } catch { return 'recently'; } })();
      return `• 🔴 "${i.name}" — started ${age} ago`;
    });
    return `Here's what's happening with ${pi.vendorName}:\n\n${lines.join('\n')}`;
  }

  // 2. If keyword search found results (user searching across vendors, e.g. "AWS outage")
  if (pi.searchResults.length > 0) {
    const keyword = pi.keywords.join(', ');
    const lines = pi.searchResults.slice(0, 8).map((i) => {
      const status = i.resolvedAt ? '✅ Resolved' : '🔴 Ongoing';
      const dur = i.durationMinutes ? ` (${i.durationMinutes} min)` : '';
      return `• ${i.vendorName}: "${i.name}" — ${status}${dur}`;
    });
    let msg = `I found ${pi.searchResults.length} incident(s) related to "${keyword}":\n\n${lines.join('\n')}`;
    if (pi.searchResults.length > 8) {
      msg += `\n\n...and ${pi.searchResults.length - 8} more.`;
    }
    return msg;
  }

  // 3. Active incidents (no specific vendor matched)
  if (pi.type === 'active_incidents' || pi.type === 'status_check') {
    if (pi.activeIncidents.length === 0) {
      return '✅ All monitored services are looking good — no active incidents across any vendor right now.';
    }
    const lines = pi.activeIncidents.slice(0, 6).map((i) => {
      const age = (() => { try { return formatDistanceToNow(parseISO(i.startedAt)); } catch { return 'recently'; } })();
      return `• 🔴 ${i.vendorName}: "${i.name}" — started ${age} ago`;
    });
    return `There are currently ${pi.activeIncidents.length} active incident(s):\n\n${lines.join('\n')}`;
  }

  // 3. If asking about history
  if (pi.type === 'history') {
    if (pi.recentIncidents.length === 0) {
      return pi.vendorName
        ? `No recent incidents found for ${pi.vendorName}. This is good news! 🎉`
        : 'No recent incidents found in the system.';
    }
    const lines = pi.recentIncidents.slice(0, 8).map((i) => {
      const status = i.resolvedAt ? '✅ Resolved' : '🔴 Ongoing';
      const dur = i.durationMinutes ? ` (${i.durationMinutes} min)` : '';
      return `• ${i.vendorName}: "${i.name}" — ${status}${dur}`;
    });
    const prefix = pi.vendorName
      ? `Here are the recent incidents for ${pi.vendorName}:`
      : 'Here are the most recent incidents across all vendors:';
    return `${prefix}\n\n${lines.join('\n')}`;
  }

  // 4. General fallback — brief status overview
  const dataLines = ctx.dataBlock
    .split('\n')
    .filter((l) => l.trim().startsWith('🟢') || l.trim().startsWith('🟡') || l.trim().startsWith('🔴'));
  if (dataLines.length > 0) {
    const operational = dataLines.filter((l) => l.includes('🟢')).length;
    const degraded = dataLines.filter((l) => l.includes('🟡')).length;
    const outage = dataLines.filter((l) => l.includes('🔴')).length;
    let msg = "Here's a quick overview:\n\n";
    if (outage > 0) msg += `🔴 ${outage} service(s) experiencing an outage\n`;
    if (degraded > 0) msg += `🟡 ${degraded} service(s) degraded\n`;
    if (operational > 0) msg += `🟢 ${operational} service(s) fully operational\n`;
    msg += '\nTry asking about a specific service or topic — e.g. "Any AWS related outages?" or "Snowflake incidents this week"';
    return msg;
  }

  return "I'm having trouble reading the current data. Please try again in a moment.";
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
    const ctx = buildBotContext(question, cache);

    let answer: string;

    try {
      answer = await generateWithGemini(SYSTEM_PROMPT, ctx.dataBlock, question, conversationHistory);
    } catch (llmErr) {
      console.warn('[Bot] LLM unavailable, using smart template fallback:', llmErr);
      answer = templateAnswer(ctx, question);
    }

    return NextResponse.json({
      answer,
      sources: ctx.sources,
      confidence: ctx.hasData ? 'high' : 'none',
      dataAsOf: ctx.dataAsOf,
    });
  } catch (err) {
    console.error('[Bot] /api/bot critical error:', err);
    return NextResponse.json(
      { error: 'Bot service unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
