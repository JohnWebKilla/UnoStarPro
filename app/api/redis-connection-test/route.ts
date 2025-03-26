import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export async function GET() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        {
          status: "error",
          message: "Redis client not initialized",
          config: {
            status: "error",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "unknown",
            upstashUrl: process.env.UPSTASH_REDIS_REST_URL
              ? "configured"
              : "not configured",
          },
        },
        { status: 500 }
      );
    }

    // Test Redis connection with PING
    const pingResult = await redis.ping();

    // Get Redis status
    const config = {
      status: pingResult === "PONG" ? "connected" : "error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      upstashUrl: process.env.UPSTASH_REDIS_REST_URL
        ? "configured"
        : "not configured",
    };

    // Test basic operations
    const testKey = "connection_test";
    await redis.set(testKey, "test_value");
    const testValue = await redis.get(testKey);
    await redis.del(testKey);

    return NextResponse.json({
      status: "success",
      config,
      operations: {
        set: "success",
        get: testValue === "test_value" ? "success" : "failed",
        delete: "success",
      },
    });
  } catch (error: any) {
    console.error("Redis connection test failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Redis connection test failed",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}
