import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a fallback mock redis if env vars are missing so we don't crash
// In a real production app we would enforce these are set
const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = isRedisConfigured ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : {} as Redis; // Mock for build/dev if not provided

export const aggregateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  ephemeralCache: new Map(),
  analytics: true,
});

export const botRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  ephemeralCache: new Map(),
  analytics: true,
});

export const cronRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "1 m"),
  ephemeralCache: new Map(),
  analytics: true,
});

export async function checkRateLimit(
  limit: Ratelimit, 
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (!isRedisConfigured) {
    // If not configured, just let it pass
    return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
  }
  return await limit.limit(identifier);
}
