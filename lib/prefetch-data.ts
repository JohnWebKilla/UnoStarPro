import { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

// Initialize Redis client with correct URL format and retry options
const redis = new Redis({
  url: process.env.REDIS_URL
    ? `https://${process.env.REDIS_URL.replace(/^redis:\/\//, "")}`
    : "",
  token: process.env.REDIS_PASSWORD || "",
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.min(retryCount * 100, 3000), // Exponential backoff with max 3s
  },
});

export async function prefetchData(supabase: SupabaseClient, role?: string) {
  try {
    if (!process.env.REDIS_URL || !process.env.REDIS_PASSWORD) {
      console.warn("Redis credentials not found, skipping prefetch");
      return;
    }

    // Common data for all roles
    const commonPromises = [
      // Fetch and cache companies with timeout
      Promise.race([
        supabase
          .from("companies")
          .select("*")
          .then(async ({ data: companies }) => {
            if (companies) {
              await redis.set("companies", JSON.stringify(companies), {
                ex: 3600,
              });
            }
          }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), 5000)
        ),
      ]),
    ];

    // Role-specific data
    if (role === "admin" || role === "manager") {
      const adminPromises = [
        // Fetch and cache drivers with timeout
        Promise.race([
          supabase
            .from("drivers")
            .select("*")
            .then(async ({ data: drivers }) => {
              if (drivers) {
                await redis.set("drivers", JSON.stringify(drivers), {
                  ex: 3600,
                });
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Fetch timeout")), 5000)
          ),
        ]),
        // Fetch and cache users with timeout
        Promise.race([
          supabase
            .from("users")
            .select("*")
            .then(async ({ data: users }) => {
              if (users) {
                await redis.set("users", JSON.stringify(users), { ex: 3600 });
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Fetch timeout")), 5000)
          ),
        ]),
      ];
      await Promise.allSettled([...commonPromises, ...adminPromises]);
    } else {
      await Promise.allSettled(commonPromises);
    }

    console.log("Data prefetch attempted for role:", role);
  } catch (error) {
    console.error("Error prefetching data:", error);
    // Don't throw error to prevent blocking sign-in
  }
}
