import { NextRequest, NextResponse } from "next/server";
import {
  fetchWithCache,
  buildSupabaseCacheKey,
  invalidateCache,
} from "@/lib/supabase-cache";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const skipCache = searchParams.get("skipCache") === "true";

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Build cache key
    const cacheKey = skipCache
      ? undefined
      : buildSupabaseCacheKey("users", "get", userId);

    // Use the fetchWithCache utility
    const result = await fetchWithCache(
      "users",
      async (supabase) => {
        return await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
      },
      cacheKey,
      CACHE_EXPIRATION
    );

    if (result.error) {
      const status = result.error.code === "PGRST116" ? 404 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    if (!result.data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: result.data,
      source: result.source || "database",
      cached: result.source === "cache",
    });
  } catch (error: any) {
    console.error("Error fetching user data:", error);

    return NextResponse.json(
      { error: error.message || "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Invalidate the cache for this user
    const cacheKey = buildSupabaseCacheKey("users", "get", userId);
    await invalidateCache(cacheKey);

    return NextResponse.json({
      success: true,
      message: "Cache invalidated successfully",
    });
  } catch (error: any) {
    console.error("Error invalidating cache:", error);

    return NextResponse.json(
      { error: error.message || "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
