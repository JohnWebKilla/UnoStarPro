import { NextResponse } from "next/server";
import { RedisManager } from "@/lib/redis-manager";

export async function GET() {
  try {
    const isConnected = await RedisManager.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { status: "error", message: "Redis is not connected" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok", message: "Redis is connected" });
  } catch (error) {
    console.error("Redis health check failed:", error);
    return NextResponse.json(
      { status: "error", message: "Redis health check failed" },
      { status: 500 }
    );
  }
}
