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

const SYSTEM_PROMPT = `You are an IT Service Desk Assistant for the Nexus Status Grid.
Your job is to report on the health of these 11 services: ${KNOWN_VENDOR_NAMES}.

## Tone & Rules for Maximum Efficiency
1. **Be Hyper-Concise:** Get straight to the point. Use max 1-2 short sentences of conversational text.
2. **Use Strict Formatting:** Always use bullet points and bold text for service names. 
3. **No Fluff:** Do not use robotic filler like "I have analyzed the data" or "Here is the information."
4. **Clarify Vague Queries:** If a user asks "Is it down?" without naming a service, reply: "Please specify which service you are asking about."
5. **Only Use Provided Data:** Never invent incidents. If the data is empty or irrelevant, state: "No data available for that query."
6. **Detail Requests:** Only provide detailed, long-form explanations if the user explicitly asks for "details" or a "detailed summary".

## Few-Shot Examples (Follow this exact format)

User: Is GitHub down?
Nexus: ✅ **GitHub** is fully operational right now with no active incidents.

User: Any AWS outages?
Nexus: I found 1 ongoing incident related to AWS:
- 🔴 **Snowflake**: "AWS - Middle East (UAE) Outage" — started 2 hours ago.

User: What are the active incidents?
Nexus: There are currently 2 active incidents:
- 🔴 **Cloudflare**: "Bot Management Issues" — started 2 days ago.
- 🔴 **MongoDB Atlas**: "Impaired Cluster Operations" — started 3 hours ago.

User: Is it working?
Nexus: Please specify which service you are asking about.`;

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
    const ongoing = pi.searchResults.filter((i) => !i.resolvedAt);
    const resolved = pi.searchResults.filter((i) => i.resolvedAt);

    if (ongoing.length > 0) {
      // Lead with real-time ongoing incidents
      const lines = ongoing.slice(0, 6).map((i) => {
        const age = (() => { try { return formatDistanceToNow(parseISO(i.startedAt)); } catch { return 'recently'; } })();
        return `• 🔴 ${i.vendorName}: "${i.name}" — ongoing, started ${age} ago`;
      });
      let msg = `There are ${ongoing.length} ongoing incident(s) related to "${keyword}":\n\n${lines.join('\n')}`;
      if (resolved.length > 0) {
        msg += `\n\nThere are also ${resolved.length} resolved past incident(s) matching "${keyword}". Ask me about past ${keyword} incidents if you'd like details.`;
      }
      return msg;
    }

    // No ongoing — mention that it's all in the past
    const lines = resolved.slice(0, 6).map((i) => {
      const dur = i.durationMinutes ? ` (${i.durationMinutes} min)` : '';
      return `• ${i.vendorName}: "${i.name}" — ✅ Resolved${dur}`;
    });
    let msg = `No ongoing incidents related to "${keyword}" right now. ✅\n\nHowever, there were ${resolved.length} past incident(s):`;
    msg += `\n\n${lines.join('\n')}`;
    if (resolved.length > 6) msg += `\n\n...and ${resolved.length - 6} more.`;
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
