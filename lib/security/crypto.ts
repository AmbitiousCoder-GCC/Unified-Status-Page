import { timingSafeEqual } from "crypto";

/**
 * Compares two strings in constant time to prevent timing attacks.
 */
export function validateSecretTiming(provided: string, expected: string): boolean {
    try {
        if (!provided || !expected) return false;
        
        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);
        
        if (providedBuffer.length !== expectedBuffer.length) {
            // Still run the comparison to some extent if possible, 
            // but normally we just return false if lengths differ.
            return false;
        }
        
        return timingSafeEqual(providedBuffer, expectedBuffer);
    } catch (error) {
        console.error("Timing safe comparison failed:", error);
        return false;
    }
}

/**
 * Validates that all required environment variables are set.
 * Should be called at application startup.
 */
export function validateEnvironmentVariables(): void {
    const required = [
        "POSTGRES_URL",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "GOOGLE_GENERATIVE_AI_API_KEY",
        "CRON_SECRET"
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
}
