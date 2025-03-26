import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "./redis";

interface RateLimitConfig {
  // Maximum number of requests allowed in the time window
  limit: number;
  // Time window in seconds
  windowInSeconds: number;
  // Optional identifier for the rate limit (e.g., 'api', 'auth')
  identifier?: string;
}

/**
 * Rate limiting middleware using Redis
 *
 * @param req - Next.js request object
 * @param config - Rate limit configuration
 * @returns NextResponse or undefined if rate limit not exceeded
 */
export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | undefined> {
  const { limit, windowInSeconds, identifier = "default" } = config;

  // Get client IP or a fallback
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Create a unique key for this IP and rate limit identifier
  const key = `rate-limit:${identifier}:${ip}`;

  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn("Redis client not initialized, skipping rate limiting");
      return undefined;
    }

    // Get current count
    const currentCount = await redis.get(key);
    const count = currentCount ? parseInt(currentCount.toString(), 10) : 0;

    // If count exceeds limit, return error response
    if (count >= limit) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${windowInSeconds} seconds.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": (
              Math.floor(Date.now() / 1000) + windowInSeconds
            ).toString(),
          },
        }
      );
    }

    // Increment count
    await redis.incr(key);

    // Set expiration if this is the first request in the window
    if (count === 0) {
      await redis.expire(key, windowInSeconds);
    }

    // Get the TTL to calculate remaining time
    const ttl = await redis.ttl(key);

    // Add rate limit headers to the response
    const headers = new Headers();
    headers.set("X-RateLimit-Limit", limit.toString());
    headers.set("X-RateLimit-Remaining", (limit - count - 1).toString());
    headers.set(
      "X-RateLimit-Reset",
      (Math.floor(Date.now() / 1000) + (ttl || 0)).toString()
    );

    // No need to block the request, just return undefined
    return undefined;
  } catch (error) {
    console.error("Rate limiting error:", error);
    // If Redis fails, allow the request to proceed
    return undefined;
  }
}
