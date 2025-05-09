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

export async function getCompaniesAction(): Promise<{
  data: Company[];
  source: "cache" | "database";
  timing: { total: number; database?: number };
}> {
  const startTime = Date.now();

  try {
    // Try to get from cache first
    const cachedCompanies = (await getCachedCompanyList()) as Company[] | null;
    if (cachedCompanies) {
      console.log("Using cached companies data from Redis");
      return {
        data: cachedCompanies,
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
    const { data: companies, error } = await withRetry(async () => {
      return await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
    });

    if (error) throw error;

    // Cache the results
    await setCompanyListCache(companies);
    console.log("Companies data cached in Redis with key:", COMPANY_LIST_KEY);

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
  const startTime = Date.now();
  console.log(`Fetching users for company ${companyId}...`);

  try {
    // Try to get from cache first
    const cacheKey = `company_users_${companyId}`;
    const cachedUsers = (await getCachedCompany(parseInt(cacheKey))) as
      | any[]
      | null;

    if (cachedUsers) {
      console.log(`Using cached users for company ${companyId}`);
      return cachedUsers;
    }

    const supabase = await createClient();

    // Get users with profiles
    const { data: users, error } = await supabase
      .from("auth_users")
      .select(
        `
        id,
        email,
        profiles (
          first_name,
          last_name,
          company_id,
          role,
          status
        )
      `
      )
      .eq("profiles.company_id", companyId);

    if (error) throw error;

    // Transform the data for easier use
    const transformedUsers = users
      .filter((user) => user.profiles?.length > 0)
      .map((user) => ({
        id: user.id,
        email: user.email,
        ...user.profiles[0],
      }));

    // Cache the result
    if (transformedUsers.length > 0) {
      await setCompanyDetailCache(parseInt(cacheKey), transformedUsers);
    }

    const endTime = Date.now();
    console.log(
      `Fetched ${transformedUsers.length} users in ${endTime - startTime}ms`
    );

    return transformedUsers;
  } catch (error) {
    console.error(`Error fetching users for company ${companyId}:`, error);
    throw error;
  }
}

export async function clearCompanyUsersCache(companyId: number) {
  try {
    const cacheKey = `company_users_${companyId}`;
    const inProgressKey = `company_users_inprogress_${companyId}`;

    // Clear both cache keys
    await clearCompanyCache(parseInt(cacheKey), true);
    await clearCompanyCache(parseInt(inProgressKey), true);

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
  const cacheKey = `company_users_${companyId}`;
  const inProgressKey = `company_users_inprogress_${companyId}`;

  try {
    // Try to get from cache with a longer TTL (24 hours)
    const cachedUsers = (await getCachedCompany(parseInt(cacheKey))) as
      | any[]
      | null;

    if (cachedUsers) {
      console.log(`[Optimized] Using cached users for company ${companyId}`);
      return cachedUsers;
    }

    // Check if there's an in-progress fetch
    const inProgress = (await getCachedCompany(parseInt(inProgressKey))) as
      | boolean
      | null;
    if (inProgress) {
      console.log(
        `[Optimized] Another request is already fetching users for company ${companyId}`
      );
      // Wait a short time and try the cache again
      await new Promise((resolve) => setTimeout(resolve, 500));
      const retryCachedUsers = (await getCachedCompany(parseInt(cacheKey))) as
        | any[]
        | null;
      if (retryCachedUsers) {
        return retryCachedUsers;
      }
      // If still no cached data, continue with the fetch
    }

    // Mark this fetch as in progress
    await setCompanyDetailCache(parseInt(inProgressKey), true);

    // Execute the original function
    const users = await getCompanyUsersAction(companyId);

    // Cache with a longer TTL (24 hours)
    await setCompanyDetailCache(parseInt(cacheKey), users);

    // Clear the in-progress flag
    await clearCompanyCache(parseInt(inProgressKey), true);

    const endTime = Date.now();
    console.log(
      `[Optimized] Fetched and cached ${users.length} users in ${
        endTime - startTime
      }ms`
    );

    return users;
  } catch (error) {
    // Clear in-progress flag on error
    await clearCompanyCache(parseInt(inProgressKey), true);
    console.error(`[Optimized] Error fetching users: ${error}`);
    return [];
  }
}
