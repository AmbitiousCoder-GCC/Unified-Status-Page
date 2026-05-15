import { expect, test, describe, vi } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/vendors/botContext', () => ({
  buildBotContext: vi.fn().mockResolvedValue({
    dataBlock: 'mock data',
    hasData: true,
    dataAsOf: '2026-05-16T00:00:00Z',
    sources: []
  })
}));

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      answer: 'Mock answer',
      confidence: 'high',
      sources: [],
      suggestedQueries: [],
      detectedIntent: 'general',
      requiresAction: false
    }
  })
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn()
}));

vi.mock('@/app/api/rate-limit', () => ({
  botRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 })
}));

describe('Bot API Route', () => {
  test('returns structured output', async () => {
    const req = new NextRequest('http://localhost/api/bot', {
      method: 'POST',
      body: JSON.stringify({ question: 'Hello?' })
    });
    
    const response = await POST(req);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.answer).toBe('Mock answer');
    expect(data.confidence).toBe('high');
  });
});
