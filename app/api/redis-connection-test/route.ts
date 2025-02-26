import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export async function GET() {
  try {
    const redis = getRedisClient();

    // Test basic connection
    const pingResult = await redis.ping();

    // Get Redis info
    const info = await redis.info();

    // Get Redis config
    const config = {
      host: redis.options.host,
      port: redis.options.port,
      tls: !!redis.options.tls,
      password: redis.options.password ? "******" : "not set",
    };

    return NextResponse.json({
      status: "success",
      ping: pingResult,
      config,
      info: {
        redisVersion:
          info
            .split("\n")
            .find((line) => line.startsWith("redis_version"))
            ?.split(":")[1]
            ?.trim() || "unknown",
        connected_clients:
          info
            .split("\n")
            .find((line) => line.startsWith("connected_clients"))
            ?.split(":")[1]
            ?.trim() || "unknown",
        used_memory_human:
          info
            .split("\n")
            .find((line) => line.startsWith("used_memory_human"))
            ?.split(":")[1]
            ?.trim() || "unknown",
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
        config: {
          host: process.env.REDIS_URL?.split(":")[0] || "localhost",
          port: process.env.REDIS_URL?.split(":")[1] || 6379,
          password: process.env.REDIS_PASSWORD ? "set" : "not set",
        },
      },
      { status: 500 }
    );
  }
}
