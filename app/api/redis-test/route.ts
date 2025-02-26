import { NextResponse } from "next/server";
import { getRedisClient, setCache, getCache } from "@/lib/redis";

export async function GET() {
  try {
    const redis = await getRedisClient();

    // Test basic connection
    const pingResult = await redis.ping();

    // Test setting and getting a value
    const testKey = "test:connection";
    const testValue = {
      timestamp: new Date().toISOString(),
      message: "Redis connection test",
    };

    await setCache(testKey, testValue, 60); // Cache for 1 minute
    const retrievedValue = await getCache(testKey);

    // Check if values match
    const valuesMatch =
      JSON.stringify(testValue) === JSON.stringify(retrievedValue);

    return NextResponse.json({
      status: "success",
      ping: pingResult,
      connectionTest: valuesMatch ? "passed" : "failed",
      original: testValue,
      retrieved: retrievedValue,
      info: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
    });
  } catch (error: any) {
    console.error("Redis test error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
