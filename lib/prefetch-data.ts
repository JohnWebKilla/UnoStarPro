import { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function prefetchData(supabase: SupabaseClient, role?: string) {
  try {
    // Common data for all roles
    const commonPromises = [
      // Fetch and cache companies
      supabase
        .from("companies")
        .select("*")
        .then(async ({ data: companies }) => {
          if (companies) {
            await redis.set("companies", JSON.stringify(companies), {
              ex: 3600,
            }); // 1 hour expiry
          }
        }),
    ];

    // Role-specific data
    if (role === "admin" || role === "manager") {
      const adminPromises = [
        // Fetch and cache drivers
        supabase
          .from("drivers")
          .select("*")
          .then(async ({ data: drivers }) => {
            if (drivers) {
              await redis.set("drivers", JSON.stringify(drivers), { ex: 3600 });
            }
          }),
        // Fetch and cache users
        supabase
          .from("users")
          .select("*")
          .then(async ({ data: users }) => {
            if (users) {
              await redis.set("users", JSON.stringify(users), { ex: 3600 });
            }
          }),
      ];
      await Promise.all([...commonPromises, ...adminPromises]);
    } else {
      await Promise.all(commonPromises);
    }

    console.log("Data prefetched successfully for role:", role);
  } catch (error) {
    console.error("Error prefetching data:", error);
    // Don't throw error to prevent blocking sign-in
  }
}
