import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { revalidatePath } from "next/cache";

// Initialize Redis client
let redis: Redis | null = null;

try {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken =
    process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    console.log("Successfully connected to Upstash Redis");
  } else {
    console.warn(
      "Redis credentials not found. Cache operations will be disabled."
    );
  }
} catch (error) {
  console.error("Failed to initialize Redis client:", error);
}

/**
 * API endpoint for batch invalidating multiple cache keys in a single operation
 * This reduces network overhead and improves performance compared to making
 * multiple individual cache invalidation requests
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Parse the request body
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: keys must be a non-empty array" },
        { status: 400 }
      );
    }

    // Check if Redis is available
    if (!redis) {
      return NextResponse.json(
        { warning: "Redis not available, cache operations skipped" },
        { status: 200 }
      );
    }

    // Use pipeline to perform all deletions in a single Redis operation
    const pipeline = redis.pipeline();

    // Add each key to the pipeline
    for (const key of keys) {
      pipeline.del(key);
    }

    // Execute the pipeline
    const results = await pipeline.exec();

    // Check which paths to revalidate based on the keys
    const pathsToRevalidate = new Set<string>();

    for (const key of keys) {
      if (key.includes("companies:list")) {
        pathsToRevalidate.add("/Companies");
      }

      // Match company detail keys (companies:59)
      const companyMatch = key.match(/companies:(\d+)/);
      if (companyMatch) {
        pathsToRevalidate.add(`/Companies/${companyMatch[1]}`);
      }
    }

    // Revalidate all unique paths
    for (const path of Array.from(pathsToRevalidate)) {
      revalidatePath(path);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Successfully invalidated ${keys.length} cache keys in ${duration}ms`,
      keys,
      results,
    });
  } catch (error: any) {
    console.error("Error in batch cache invalidation:", error);

    return NextResponse.json(
      {
        error: "Failed to invalidate cache",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
