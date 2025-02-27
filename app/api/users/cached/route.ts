import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCache, setCache, deleteCache } from "@/lib/redis";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

// Define types for our data
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  phone_number?: string;
  avatar?: string;
  dob?: string;
  has_all_access: boolean;
  created_at: string;
  updated_at: string;
  companies?: Array<{
    id: number;
    name: string;
    status: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get("skipCache") === "true";
    const userId = searchParams.get("userId");
    const startTime = Date.now();

    // If userId is provided, fetch specific user without caching
    if (userId) {
      const supabase = await createClient();
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    // Build cache key for all users
    const cacheKey = `users:all`;
    console.log(`Processing request for ${cacheKey}, skipCache=${skipCache}`);

    // Try to get data from cache if not skipping
    if (!skipCache) {
      try {
        // Set a shorter timeout for cache retrieval in serverless
        const timeoutMs = process.env.VERCEL ? 2000 : 3000;

        const cachedData = await Promise.race([
          getCache<User[]>(cacheKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache retrieval timed out")),
              timeoutMs
            )
          ),
        ]);

        if (cachedData) {
          console.log(
            `Cache hit for ${cacheKey} (${Date.now() - startTime}ms)`
          );
          return NextResponse.json({
            data: cachedData,
            source: "cache",
            timing: {
              total: Date.now() - startTime,
              source: "cache",
            },
          });
        }
        console.log(`Cache miss for ${cacheKey}`);
      } catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
        // Continue to database if cache fails
      }
    }

    // If not in cache or skipping cache, fetch from database
    console.log("Fetching users data from database");

    const supabase = await createClient();
    const dbStartTime = Date.now();

    // Fetch all users with their company information
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_companies (
          companies (
            id,
            name,
            status
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Transform the data to include company information
    const transformedUsers = users.map((user: any) => {
      let assignedCompanies = [];

      // If user has all access, include all active companies
      if (user.has_all_access) {
        // In a real implementation, you might want to fetch all companies here
        // For now, we'll just use what's assigned
      }

      // Extract companies from user_companies relation
      if (user.user_companies && user.user_companies.length > 0) {
        assignedCompanies = user.user_companies
          .filter(
            (uc: any) => uc.companies && uc.companies.status !== "deleted"
          )
          .map((uc: any) => uc.companies);
      }

      // Remove the user_companies field and add the companies field
      const { user_companies, ...userWithoutCompanies } = user;
      return {
        ...userWithoutCompanies,
        companies: assignedCompanies,
      };
    });

    const dbTime = Date.now() - dbStartTime;
    console.log(`Database fetch completed in ${dbTime}ms`);

    // Store in cache for future requests
    try {
      await setCache(cacheKey, transformedUsers, CACHE_EXPIRATION);
      console.log(`Cached data for ${cacheKey}`);
    } catch (cacheError) {
      console.error("Cache storage error:", cacheError);
      // Continue even if caching fails
    }

    return NextResponse.json({
      data: transformedUsers,
      source: "database",
      timing: {
        total: Date.now() - startTime,
        database: dbTime,
      },
    });
  } catch (error) {
    console.error("Error in users/cached route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cacheKey = `users:all`;
    await deleteCache(cacheKey);
    return NextResponse.json({
      message: `Cache invalidated for ${cacheKey}`,
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
