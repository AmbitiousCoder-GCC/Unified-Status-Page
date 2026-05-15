// components/ChatBot/useChatBot.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import type { BotMessage, BotResponse } from '@/types/bot';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useChatBot() {
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: generateId(),
      role: 'assistant',
      content: 'Hi! Ask me about any vendor outages, past incidents, or uptime analytics. I monitor GitHub, GitLab, MongoDB, Google Cloud, Auth0, Databricks, Cloudflare, Azure, Snowflake, SailPoint, and Cycode.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: BotMessage = {
      id: generateId(),
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const history = messages
        .filter((m) => m.role !== 'assistant' || m !== messages[0])
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), conversationHistory: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `Server error ${res.status}`);
      }

      const data: BotResponse = await res.json();

      const assistantMsg: BotMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        confidence: data.confidence,
        suggestedQueries: data.suggestedQueries,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(errMsg);
      const errBotMsg: BotMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I ran into an error: ${errMsg}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errBotMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        content: 'Chat cleared. Ask me anything about vendor status.',
        timestamp: new Date().toISOString(),
      },
    ]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}
