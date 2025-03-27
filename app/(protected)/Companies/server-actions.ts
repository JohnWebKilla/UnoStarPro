"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Company } from "./types";
import { revalidatePath } from "next/cache";
import { updateCompanyInStripe } from "./stripe-actions";
import { setCache, getCache } from "@/lib/redis";

// Update cache key to match API pattern
const COMPANIES_CACHE_KEY = "api:/api/companies";
const CACHE_TTL = 3600; // 1 hour

export async function getCompaniesAction(): Promise<{
  data: Company[];
  source: "cache" | "database";
  timing: { total: number; database?: number };
}> {
  const startTime = Date.now();

  try {
    // Try to get from cache first
    const cachedData = await getCache<Company[]>(COMPANIES_CACHE_KEY);
    if (cachedData) {
      console.log("Using cached companies data from Redis");
      return {
        data: cachedData,
        source: "cache",
        timing: { total: Date.now() - startTime },
      };
    }

    // If not in cache, fetch from database
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const dbStartTime = Date.now();
    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Cache the results
    await setCache(COMPANIES_CACHE_KEY, companies, CACHE_TTL);
    console.log(
      "Companies data cached in Redis with key:",
      COMPANIES_CACHE_KEY
    );

    return {
      data: companies,
      source: "database",
      timing: {
        total: Date.now() - startTime,
        database: Date.now() - dbStartTime,
      },
    };
  } catch (error) {
    console.error("Error in getCompaniesAction:", error);
    throw error;
  }
}

export async function invalidateCompaniesCache(): Promise<void> {
  try {
    await setCache(COMPANIES_CACHE_KEY, null, 0);
    console.log("Companies cache invalidated");
  } catch (error) {
    console.error("Error invalidating companies cache:", error);
    throw error;
  }
}

export async function createCompanyAction(
  companyData: Partial<Company>
): Promise<Company> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...companyData,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/Companies");
  return data;
}

export async function updateCompanyAction(
  id: number,
  companyData: Partial<Company>
): Promise<Company> {
  const supabase = await createClient();

  // First, get the current company data
  const { data: existingCompany, error: fetchError } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  // Update in database
  const { data, error } = await supabase
    .from("companies")
    .update({
      ...companyData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If company has Stripe connection and relevant fields were updated, sync with Stripe
  if (data.stripe_customer_id) {
    const relevantFields = [
      "name",
      "contact_email",
      "contact_phone",
      "contact_first_name",
      "contact_last_name",
      "status",
    ];

    const hasRelevantChanges = Object.keys(companyData).some(
      (key) =>
        relevantFields.includes(key) &&
        companyData[key as keyof Company] !==
          existingCompany[key as keyof Company]
    );

    if (hasRelevantChanges) {
      try {
        await updateCompanyInStripe(data);
      } catch (stripeError) {
        console.error("Failed to sync company with Stripe:", stripeError);
        // We might want to notify the user but not fail the operation
      }
    }
  }

  revalidatePath("/Companies");
  return data;
}

export async function deleteCompanyAction(id: number): Promise<void> {
  const supabase = await createClient();

  // First, get the company data
  const { data: company, error: fetchError } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (!company) throw new Error("Company not found");

  // Check if company has active subscriptions - we won't allow deletion in that case
  if (company.stripe_customer_id && company.subscription_status === "active") {
    throw new Error(
      "Cannot delete company with active subscriptions. Please cancel the subscription first."
    );
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .single();

  if (dbError) {
    console.error("Database deletion error:", dbError);
    throw new Error(
      `Failed to delete company from database: ${dbError.message}`
    );
  }

  revalidatePath("/Companies");
}

// Utility function for retrying operations
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 1) throw error;
    console.log(`Operation failed, retrying... (${retries - 1} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 1.5);
  }
}

export async function getCompanyUsersAction(companyId: number) {
  const startTime = Date.now();
  console.log(`Fetching users for company ${companyId}...`);

  try {
    const supabase = await createClient();

    // Try to get from cache first
    const cacheKey = `company_users:${companyId}`;
    const cachedUsers = await getCache<any[]>(cacheKey);

    if (cachedUsers) {
      console.log(`Using cached users for company ${companyId} from Redis`);
      const endTime = Date.now();
      console.log(`Users fetched from cache in ${endTime - startTime}ms`);
      return cachedUsers;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get users through the junction table with a timeout for debugging and retry capability
    const queryStartTime = Date.now();

    const { data: users, error } = await withRetry(
      async () => {
        // Use a more efficient query with explicit join instead of nested select
        return await supabase
          .from("user_companies")
          .select(
            `
            users:users!inner(
              id,
              email,
              role,
              created_at,
              first_name,
              last_name,
              status
            )
          `
          )
          .eq("company_id", companyId);
      },
      3,
      500
    );

    const queryEndTime = Date.now();
    console.log(`Database query took ${queryEndTime - queryStartTime}ms`);

    if (error) {
      console.error(`Error fetching users for company ${companyId}:`, error);
      throw error;
    }

    // Transform the data to match the CompanyUser interface
    const transformedUsers = users.map((item: any) => ({
      id: item.users.id,
      email: item.users.email,
      role: item.users.role,
      created_at: item.users.created_at,
      first_name: item.users.first_name,
      last_name: item.users.last_name,
      status: item.users.status,
    }));

    console.log(
      `Fetched ${transformedUsers.length} users for company ${companyId}`
    );

    // Cache the result for 5 minutes (300 seconds)
    await setCache(cacheKey, transformedUsers, 300);

    const endTime = Date.now();
    console.log(`Total user fetch time: ${endTime - startTime}ms`);

    return transformedUsers;
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `Failed to fetch users for company ${companyId} after ${endTime - startTime}ms:`,
      error
    );
    throw error;
  }
}

export async function clearCompanyUsersCache(companyId: number) {
  const cacheKey = `company_users:${companyId}`;
  const inProgressKey = `company_users_in_progress:${companyId}`;

  try {
    // Clear both cache keys
    await setCache(cacheKey, null, 0);
    await setCache(inProgressKey, null, 0);

    console.log(`Cleared cache for company ${companyId} users`);
    return true;
  } catch (error) {
    console.error(`Failed to clear cache for company ${companyId}:`, error);
    return false;
  }
}

export async function getCompanyUsersOptimized(companyId: number) {
  // First check if we already have a fetch in progress for this company
  const cacheKey = `company_users:${companyId}`;
  const inProgressKey = `company_users_in_progress:${companyId}`;

  try {
    console.log(`[Optimized] Fetching users for company ${companyId}...`);
    const startTime = Date.now();

    // Try to get from cache with a longer TTL (24 hours)
    const cachedUsers = await getCache<any[]>(cacheKey);

    if (cachedUsers) {
      const endTime = Date.now();
      console.log(
        `[Optimized] Using cached users for company ${companyId} (loaded in ${endTime - startTime}ms)`
      );
      return cachedUsers;
    }

    // Check if there's an in-progress fetch
    const inProgress = await getCache<boolean>(inProgressKey);
    if (inProgress) {
      console.log(
        `[Optimized] Fetch already in progress for company ${companyId}, returning empty array`
      );
      // Return empty array immediately rather than waiting for the other fetch
      return [];
    }

    // Mark this fetch as in progress
    await setCache(inProgressKey, true, 60); // 60 second lock

    // Execute the original function
    const users = await getCompanyUsersAction(companyId);

    // Cache with a longer TTL (24 hours)
    await setCache(cacheKey, users, 86400);

    // Clear the in-progress flag
    await setCache(inProgressKey, null, 0);

    const endTime = Date.now();
    console.log(`[Optimized] Users fetched in ${endTime - startTime}ms`);

    return users;
  } catch (error) {
    // Clear in-progress flag on error
    await setCache(inProgressKey, null, 0);
    console.error(`[Optimized] Error fetching users: ${error}`);
    return [];
  }
}
