"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Company } from "./types";
import { revalidatePath } from "next/cache";
import { updateCompanyInStripe } from "./stripe-actions";
import {
  COMPANY_LIST_KEY,
  COMPANY_DETAIL_KEY,
  CACHE_EXPIRATION,
} from "./cache";
import {
  clearCompanyCache,
  clearCompanyListCache,
  getCachedCompanyList,
  getCachedCompany,
  setCompanyListCache,
  setCompanyDetailCache,
} from "./server-cache";

// Helper function for retrying database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
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

// Define cache keys for company users
const COMPANY_USERS_KEY = (companyId: number) => `company_users:${companyId}`;
const COMPANY_USERS_PROGRESS_KEY = (companyId: number) =>
  `company_users_inprogress:${companyId}`;

export async function getCompaniesAction(): Promise<{
  data: Company[];
  source: "cache" | "database" | "error";
  timing: { total: number; database?: number };
}> {
  const startTime = Date.now();

  try {
    // Try to get from cache first
    const cachedResult = await getCachedCompanyList();

    if (cachedResult) {
      console.log("Cache hit for companies list");
      // Check if we have the new format with _meta
      if (
        typeof cachedResult === "object" &&
        cachedResult !== null &&
        "_meta" in cachedResult &&
        "data" in cachedResult &&
        Array.isArray(cachedResult.data)
      ) {
        console.log(
          `Using cached companies data from Redis (${cachedResult.data.length} items)`
        );
        return {
          data: cachedResult.data,
          source: "cache",
          timing: { total: Date.now() - startTime },
        };
      }
      // Handle legacy format (direct array)
      else if (Array.isArray(cachedResult)) {
        console.log(
          `Using cached companies data from Redis (legacy format: ${cachedResult.length} items)`
        );
        return {
          data: cachedResult,
          source: "cache",
          timing: { total: Date.now() - startTime },
        };
      }

      console.log("Unexpected cache format, fetching from database");
    } else {
      console.log("No cached companies data found");
    }

    // If not in cache or invalid format, fetch from database
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const dbStartTime = Date.now();
    const { data: companies, error } = await withRetry(async () => {
      return await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
    });

    if (error) throw error;

    if (!Array.isArray(companies)) {
      console.warn("Database returned non-array companies:", companies);
      throw new Error("Invalid database response format");
    }

    // Cache the results
    await setCompanyListCache(companies);
    console.log(
      `Cached ${companies.length} companies with key:`,
      COMPANY_LIST_KEY
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
    // Return empty array instead of throwing
    return {
      data: [],
      source: "error",
      timing: { total: Date.now() - startTime },
    };
  }
}

export async function getCompanyAction(
  companyId: number
): Promise<Company | null> {
  const startTime = Date.now();
  console.log(`Fetching company ${companyId}...`);

  try {
    // Try to get from cache first
    const cacheKey = COMPANY_DETAIL_KEY(companyId);
    const cachedCompany = (await getCachedCompany(companyId)) as Company | null;

    if (cachedCompany) {
      console.log(`Using cached company ${companyId} from Redis`);
      const endTime = Date.now();
      console.log(`Company fetched from cache in ${endTime - startTime}ms`);
      return cachedCompany;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get company data
    const { data: company, error } = await withRetry(async () => {
      return await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
    });

    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 is "Row not found"
        return null;
      }
      throw error;
    }

    // Cache the company data
    await setCompanyDetailCache(companyId, company);

    const endTime = Date.now();
    console.log(`Company fetched and cached in ${endTime - startTime}ms`);

    return company;
  } catch (error) {
    console.error(`Error fetching company ${companyId}:`, error);
    throw error;
  }
}

export async function invalidateCompaniesCache(): Promise<void> {
  try {
    await clearCompanyListCache(true);
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

  // Clear cache
  await clearCompanyListCache(true);

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

  // Clear cache for both list and this specific company
  await clearCompanyListCache();
  await clearCompanyCache(id, true);

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

  // Clear cache
  await clearCompanyListCache(true);
  await clearCompanyCache(id, true);

  revalidatePath("/Companies");
}

export async function clearCompanyCachesAction(): Promise<boolean> {
  try {
    await clearCompanyListCache(true);
    console.log("All company caches cleared");
    return true;
  } catch (error) {
    console.error("Error clearing company caches:", error);
    return false;
  }
}

export async function getCompanyUsersAction(companyId: number) {
  try {
    console.log(`Fetching users for company ${companyId}...`);
    const startTime = Date.now();

    const supabase = await createClient();

    // Check auth before proceeding
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Use efficient COUNT query first to get total size
    const { count, error: countError } = await withRetry(async () => {
      return await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);
    });

    if (countError) {
      throw countError;
    }

    // If there are too many users, use pagination
    const PAGE_SIZE = 50;
    const isLargeSet = count && count > PAGE_SIZE;

    console.log(
      `Company ${companyId} has ${count} users. Large set: ${isLargeSet}`
    );

    let users;
    if (isLargeSet) {
      // For large sets, fetch first page efficiently
      const { data: firstPageUsers, error } = await withRetry(async () => {
        return await supabase
          .from("users")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
      });

      if (error) throw error;
      users = firstPageUsers;

      // Set metadata for client to know there's more
      users._pagination = {
        total: count,
        hasMore: count > PAGE_SIZE,
        page: 1,
        pageSize: PAGE_SIZE,
      };
    } else {
      // For small sets, fetch all at once
      const { data: allUsers, error } = await withRetry(async () => {
        return await supabase
          .from("users")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
      });

      if (error) throw error;
      users = allUsers;
    }

    console.log(
      `Fetched ${users.length} users for company ${companyId} in ${Date.now() - startTime}ms`
    );

    return {
      users,
      count,
      isPartial: isLargeSet,
      timing: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`Error fetching users for company ${companyId}:`, error);
    throw error;
  }
}

export async function getCompanyUsersPage(
  companyId: number,
  page: number,
  pageSize: number = 50
) {
  try {
    console.log(`Fetching users page ${page} for company ${companyId}...`);
    const startTime = Date.now();

    const supabase = await createClient();

    // Check auth before proceeding
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Fetch the specific page
    const { data: users, error } = await withRetry(async () => {
      return await supabase
        .from("users")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
    });

    if (error) throw error;

    console.log(
      `Fetched page ${page} of users (${users.length} items) for company ${companyId} in ${Date.now() - startTime}ms`
    );

    return {
      users,
      page,
      pageSize,
      timing: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`Error fetching users page for company ${companyId}:`, error);
    throw error;
  }
}

export async function clearCompanyUsersCache(companyId: number) {
  try {
    // Clear cache for company users
    await clearCompanyCache(companyId, true);

    console.log(`Cleared cache for company ${companyId} users`);
    return true;
  } catch (error) {
    console.error(
      `Error clearing users cache for company ${companyId}:`,
      error
    );
    return false;
  }
}

export async function getCompanyUsersOptimized(companyId: number) {
  const startTime = Date.now();
  console.log(`[Optimized] Starting user fetch for company ${companyId}`);

  try {
    // Try to get from cache with a longer TTL (24 hours)
    const cachedUsers = (await getCachedCompany(companyId)) as any[] | null;

    if (cachedUsers) {
      console.log(`[Optimized] Using cached users for company ${companyId}`);
      return cachedUsers;
    }

    // Execute the original function with retry logic
    try {
      console.log(
        `[Optimized] No cache found, fetching users from database for company ${companyId}`
      );
      const users = await withRetry(async () => {
        return await getCompanyUsersAction(companyId);
      });

      const endTime = Date.now();
      console.log(
        `[Optimized] Fetched and cached ${users.length} users in ${
          endTime - startTime
        }ms`
      );

      return users;
    } catch (fetchError) {
      console.error(`[Optimized] Error in data fetch:`, fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error(`[Optimized] Error fetching users:`, error);
    // Return empty array instead of throwing error to prevent UI issues
    return [];
  }
}

export async function addTestUserToCompany(companyId: number) {
  try {
    console.log(`Adding test user for company ${companyId}`);
    const supabase = await createClient();

    // First check if test user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", `test-user-${companyId}@example.com`);

    if (checkError) {
      console.error("Error checking for existing test user:", checkError);
      throw new Error(
        `Failed to check for existing test user: ${checkError.message}`
      );
    }

    let userId;

    // If test user doesn't exist, create one
    if (!existingUsers || existingUsers.length === 0) {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: `test-user-${companyId}@example.com`,
          role: "user",
          status: "active",
          first_name: "Test",
          last_name: "User",
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating test user:", createError);
        throw new Error(`Failed to create test user: ${createError.message}`);
      }

      userId = newUser.id;
      console.log(`Created test user with ID ${userId}`);
    } else {
      userId = existingUsers[0].id;
      console.log(`Using existing test user with ID ${userId}`);
    }

    // Check if user is already associated with company
    const { data: existingAssoc, error: assocCheckError } = await supabase
      .from("user_companies")
      .select()
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (assocCheckError) {
      console.error("Error checking user association:", assocCheckError);
      throw new Error(
        `Failed to check user association: ${assocCheckError.message}`
      );
    }

    // If no association exists, create one
    if (!existingAssoc || existingAssoc.length === 0) {
      const { error: assocError } = await supabase
        .from("user_companies")
        .insert({
          user_id: userId,
          company_id: companyId,
        });

      if (assocError) {
        console.error("Error associating user with company:", assocError);
        throw new Error(
          `Failed to associate user with company: ${assocError.message}`
        );
      }

      console.log(`Associated user ${userId} with company ${companyId}`);
    } else {
      console.log(
        `User ${userId} is already associated with company ${companyId}`
      );
    }

    // Clear any existing cache for this company's users
    await clearCompanyUsersCache(companyId);

    return {
      success: true,
      message: `Test user added/linked to company ${companyId}`,
    };
  } catch (error) {
    console.error("Error adding test user:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function invalidateCompanySubscriptionCaches(
  companyId: number
): Promise<boolean> {
  try {
    console.log(
      `[Cache] Invalidating all caches for company ${companyId} after subscription update`
    );

    // Clear the cached company details
    await clearCompanyCache(companyId, true);

    // Clear the company list cache to ensure updated subscription values appear in lists
    await clearCompanyListCache(true);

    // Force revalidation of all company-related pages
    revalidatePath(`/Companies/${companyId}`);
    revalidatePath("/Companies");

    console.log(
      `[Cache] Successfully invalidated all caches for company ${companyId}`
    );

    return true;
  } catch (error) {
    console.error(
      `[Cache] Error invalidating caches for company ${companyId}:`,
      error
    );
    return false;
  }
}

/**
 * Optimized batch cache invalidation that performs all necessary invalidations
 * in a single operation, reducing network overhead and improving performance
 */
export async function batchInvalidateCompanyData(
  companyId: number
): Promise<boolean> {
  try {
    console.log(`[Cache] Batch invalidating all data for company ${companyId}`);

    const startTime = Date.now();

    // Create a Redis pipeline to execute all operations in a single request
    const supabase = await createClient();
    const redisUrl =
      process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

    if (redisUrl) {
      try {
        // Create an array of cache keys to invalidate
        const keysToInvalidate = [
          COMPANY_DETAIL_KEY(companyId),
          COMPANY_LIST_KEY,
          `company_users:${companyId}`,
          `company_users_inprogress:${companyId}`,
          `stripe_data:${companyId}`,
        ];

        // Make a single request to clear all keys
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const response = await fetch(`${baseUrl}/api/cache/batch-invalidate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ keys: keysToInvalidate }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to batch invalidate cache: ${response.statusText}`
          );
        }
      } catch (redisError) {
        console.error(
          "Redis batch invalidation failed, falling back to individual clears:",
          redisError
        );
        // Fall back to individual cache clearing
        await clearCompanyCache(companyId, true);
        await clearCompanyListCache(true);
      }
    } else {
      // Fall back to individual cache clearing
      await clearCompanyCache(companyId, true);
      await clearCompanyListCache(true);
    }

    // Force revalidation of all company-related pages
    revalidatePath(`/Companies/${companyId}`);
    revalidatePath("/Companies");

    const duration = Date.now() - startTime;
    console.log(
      `[Cache] Successfully batch invalidated all data for company ${companyId} in ${duration}ms`
    );

    return true;
  } catch (error) {
    console.error(
      `[Cache] Error batch invalidating data for company ${companyId}:`,
      error
    );
    return false;
  }
}
