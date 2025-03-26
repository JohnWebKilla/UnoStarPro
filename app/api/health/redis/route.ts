import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export async function GET() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "Redis client not initialized",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    await redis.ping();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Redis Health Check] Failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
