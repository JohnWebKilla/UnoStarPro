import { NextResponse } from "next/server";
import { RedisManager } from "@/lib/redis-manager";

export async function GET() {
  try {
    const redis = await RedisManager.getConnection();
    await redis.ping();

    return NextResponse.json({
      status: "success",
      message: "Redis connection test successful",
    });
  } catch (error) {
    console.error("Redis connection test failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Redis connection test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
