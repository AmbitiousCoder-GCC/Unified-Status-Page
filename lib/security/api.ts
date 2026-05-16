import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { validateSecretTiming } from "./crypto";

const isRedisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = isRedisConfigured 
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;

// Rate limiter: 10 requests per minute per IP
const chatLimiter = redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:chat",
}) : null;

// Rate limiter: 30 requests per minute per IP
const incidentsLimiter = redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:incidents",
}) : null;

/**
 * Checks if a chat request is within the rate limit.
 */
export async function checkChatRateLimit(request: NextRequest): Promise<boolean> {
    if (!chatLimiter) return true; // Fail open if Redis not configured
    const ip = extractClientIp(request);
    const { success } = await chatLimiter.limit(ip);
    return success;
}

/**
 * Checks if an incidents request is within the rate limit.
 */
export async function checkIncidentsRateLimit(request: NextRequest): Promise<boolean> {
    if (!incidentsLimiter) return true; // Fail open if Redis not configured
    const ip = extractClientIp(request);
    const { success } = await incidentsLimiter.limit(ip);
    return success;
}

/**
 * Validates the CRON secret using timing-safe comparison.
 */
export function validateCronSecret(authorization: string | null): boolean {
    if (!authorization) return false;
    const expectedSecret = process.env.CRON_SECRET || "";
    // Remove "Bearer " prefix if present
    const providedSecret = authorization.replace("Bearer ", "");
    return validateSecretTiming(providedSecret, expectedSecret);
}

/**
 * Extracts the client IP address from request headers.
 */
export function extractClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }
    return "unknown";
}
