"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getCache, setCache } from "@/lib/redis";
import { clearUserListCache, clearUserDetailCache } from "./cache";
import { User, UserRole } from "./types";
import { USER_LIST_KEY, USER_DETAIL_KEY, CACHE_EXPIRATION } from "./constants";

// Helper function for retrying database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }
  throw lastError;
}

// Helper function to group array items by a key
function groupBy<T extends Record<string, any>>(
  array: T[],
  key: string
): Record<string, T[]> {
  return array.reduce((result: Record<string, T[]>, item: T) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

// Get users with their companies and schedules
export async function getUsersAction(): Promise<User[]> {
  const startTime = Date.now();
  console.log("Fetching users...");

  try {
    // Try to get from cache first - do this before creating supabase client to save time
    const cachedUsers = await getCache<User[]>(USER_LIST_KEY);

    if (cachedUsers) {
      console.log("Using cached users from Redis");
      const endTime = Date.now();
      console.log(`Users fetched from cache in ${endTime - startTime}ms`);
      return cachedUsers;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get users with their company information
    const queryStartTime = Date.now();

    // Fetch users with their company associations
    const { data: users, error: usersError } = await withRetry(
      async () => {
        return await supabase
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
      },
      3,
      500
    );

    if (usersError) {
      throw usersError;
    }

    // Fetch all schedules in one batch query
    const { data: schedules, error: schedulesError } = await supabase
      .from("schedules")
      .select("user_id, working_shift, off_days");

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      // Continue without schedules if there's an error
    }

    // Index schedules by user_id for faster lookups
    const schedulesByUserId = groupBy(schedules || [], "user_id");

    // Transform the data to include company information and schedules
    const usersWithData = users.map((user: any) => {
      let assignedCompanies = [];

      // Extract companies from user_companies relation
      if (user.user_companies && user.user_companies.length > 0) {
        assignedCompanies = user.user_companies
          .filter(
            (uc: any) => uc.companies && uc.companies.status !== "deleted"
          )
          .map((uc: any) => uc.companies);
      }

      // Get schedule data for this user
      const userSchedules = schedulesByUserId[user.id] || [];
      const schedule = userSchedules.length > 0 ? userSchedules[0] : null;

      // Remove the user_companies field and add the transformed data
      const { user_companies, ...userWithoutCompanies } = user;
      return {
        ...userWithoutCompanies,
        companies: assignedCompanies,
        working_shift: schedule?.working_shift || null,
        off_days: schedule?.off_days || null,
      };
    });

    const queryEndTime = Date.now();
    console.log(`Database query took ${queryEndTime - queryStartTime}ms`);

    // Cache the result
    await setCache(USER_LIST_KEY, usersWithData, CACHE_EXPIRATION);

    const endTime = Date.now();
    console.log(`Users fetched and cached in ${endTime - startTime}ms`);

    return usersWithData;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

// Get a single user with details
export async function getUserAction(userId: string): Promise<User | null> {
  const startTime = Date.now();
  console.log(`Fetching user ${userId}...`);

  try {
    // Try to get from cache first - do this before creating supabase client
    const cacheKey = USER_DETAIL_KEY(userId);
    const cachedUser = await getCache<User>(cacheKey);

    if (cachedUser) {
      console.log(`Using cached user ${userId} from Redis`);
      const endTime = Date.now();
      console.log(`User fetched from cache in ${endTime - startTime}ms`);
      return cachedUser;
    }

    const supabase = await createClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Get user with companies in a single query
    const { data: user, error } = await supabase
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
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    if (!user) {
      return null;
    }

    // Fetch schedule data separately
    const { data: schedule } = await supabase
      .from("schedules")
      .select("working_shift, off_days")
      .eq("user_id", userId)
      .single();

    // Extract companies from user_companies relation
    let assignedCompanies = [];
    if (user.user_companies && user.user_companies.length > 0) {
      assignedCompanies = user.user_companies
        .filter((uc: any) => uc.companies && uc.companies.status !== "deleted")
        .map((uc: any) => uc.companies);
    }

    // Transform the user data
    const { user_companies, ...userWithoutCompanies } = user;
    const userWithData = {
      ...userWithoutCompanies,
      companies: assignedCompanies,
      working_shift: schedule?.working_shift || null,
      off_days: schedule?.off_days || null,
    };

    // Cache the result
    await setCache(cacheKey, userWithData, CACHE_EXPIRATION);

    const endTime = Date.now();
    console.log(`User fetched and cached in ${endTime - startTime}ms`);

    return userWithData;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    return null;
  }
}

// Clear all user caches
export async function clearUserCachesAction(): Promise<boolean> {
  try {
    // Clear the Redis cache for the user list
    await clearUserListCache();

    // Clear the Next.js cache for user-related pages
    revalidatePath("/Users");

    return true;
  } catch (error) {
    console.error("Error clearing user caches:", error);
    return false;
  }
}
