import { NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis";
import { redis } from "@/lib/upstash";

export async function GET() {
  try {
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
