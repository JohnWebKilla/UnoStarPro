"use server";

import { Redis } from "@upstash/redis";

// Create a Redis client that only runs on the server
let redis: Redis | null = null;

// Initialize Redis client only on the server
function getRedisClient() {
  if (redis) return redis;

  if (typeof window === "undefined") {
    // Only initialize on the server
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    });
  }

  return redis;
}

// Get Redis client - must be async for Server Actions
export async function getRedis() {
  return getRedisClient();
}

// Function to invalidate Stripe cache
export async function invalidateStripeCache(companyId: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    console.error("Redis client not available");
    return;
  }

  try {
    const key = `stripe_data:${companyId}`;
    await redis.del(key);

    // Also invalidate payment methods cache
    const paymentMethodsKey = `payment_methods:${companyId}`;
    await redis.del(paymentMethodsKey);

    console.log(`Cache invalidated for company ${companyId}`);
  } catch (error) {
    console.error("Error invalidating Stripe cache:", error);
    throw error;
  }
}

// Function to flush all cache
export async function flushCache(): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    console.error("Redis client not available");
    return;
  }

  try {
    await redis.flushall();
    console.log("Cache flushed successfully");
  } catch (error) {
    console.error("Error flushing cache:", error);
    throw error;
  }
}
