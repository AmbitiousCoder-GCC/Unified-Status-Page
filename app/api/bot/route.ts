import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildBotContext } from '@/lib/vendors/botContext';
import { botRateLimit, checkRateLimit } from '@/app/api/rate-limit';
import { executeBotAction } from '@/lib/bot/intents';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
  conversationHistory: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .optional()
    .default([]),
});

const BotResponseSchema = z.object({
  answer: z.string().max(1000),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(z.string()).max(5),
  suggestedQueries: z.array(z.string().max(100)).max(3),
  detectedIntent: z.enum(["status_check", "active_incidents", "history", "alert_setup", "general", "unknown"]),
  requiresAction: z.boolean().default(false),
  actionData: z.object({
    type: z.enum(["create_alert", "none"]).optional(),
    vendorId: z.string().optional(),
    thresholdMinutes: z.number().optional(),
  }).optional(),
});

const SYSTEM_PROMPT = `You are the Nexus Status Grid AI Assistant. 
You answer questions about the health and status of monitored services based strictly on the provided context.
Provide a clear, concise answer. If the user wants to set up an alert (e.g. "alert me if X is down for Y mins"), set requiresAction to true and fill actionData.`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { success, reset } = await checkRateLimit(botRateLimit, ip);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() }
    });
  }

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
    const ctx = await buildBotContext();

    const messages = [
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content: `Data Context:\n${ctx.dataBlock}\n\nUser question: ${question}`,
      },
    ];

    const { object } = await generateObject({
      model: google('gemini-2.5-pro-preview-03-25', {
        structuredOutputs: true
      }),
      system: SYSTEM_PROMPT,
      messages,
      schema: BotResponseSchema,
    });

    let finalAnswer = object.answer;

    if (object.requiresAction && object.actionData) {
      const actionResult = await executeBotAction(object.actionData);
      if (actionResult) {
        finalAnswer += `\n\n${actionResult}`;
      }
    }

    return NextResponse.json({
      answer: finalAnswer,
      confidence: object.confidence,
      sources: object.sources.length > 0 ? object.sources : ctx.sources,
      suggestedQueries: object.suggestedQueries,
      detectedIntent: object.detectedIntent
    });
  } catch (err) {
    console.error('[Bot] error:', err);
    return NextResponse.json(
      { error: 'Bot service unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
