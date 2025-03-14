import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cachedQuery, buildCacheKey } from "@/lib/cache-utils";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Build cache key
    const cacheKey = buildCacheKey("user", userId);

    // Use the cached query utility
    const result = await cachedQuery(
      cacheKey,
      async () => {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error("User not found");
        }

        return data;
      },
      CACHE_EXPIRATION
    );

    return NextResponse.json({
      data: result.data,
      source: result.source,
    });
  } catch (error: any) {
    console.error("Error fetching user data:", error);

    const status = error.message === "User not found" ? 404 : 500;
    const errorMessage = error.message || "Failed to fetch user data";

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
