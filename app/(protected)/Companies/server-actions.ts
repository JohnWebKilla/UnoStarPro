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
    const cacheKey = COMPANY_USERS_KEY(companyId);
    const cachedUsers = (await getCachedCompany(companyId)) as any[] | null;

    if (cachedUsers) {
      console.log(`Using cached users for company ${companyId}`);
      return cachedUsers;
    }

    const supabase = await createClient();

    // Get users from user_companies junction table
    console.log(`Querying user_companies table for company ${companyId}`);
    const { data: userCompanies, error: junctionError } = await supabase
      .from("user_companies")
      .select("user_id")
      .eq("company_id", companyId);

    if (junctionError) {
      console.error(
        `Error fetching from user_companies: ${junctionError.message}`
      );
      throw junctionError;
    }

    console.log(
      `Found ${userCompanies?.length || 0} user associations for company ${companyId}`
    );

    if (!userCompanies || userCompanies.length === 0) {
      console.log(`No users found for company ${companyId}`);
      return [];
    }

    // Get user details
    const userIds = userCompanies.map((uc) => uc.user_id);
    console.log(
      `Fetching details for ${userIds.length} users: ${userIds.join(", ")}`
    );

    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        role,
        status,
        created_at
      `
      )
      .in("id", userIds);

    if (error) {
      console.error(`Error fetching user details: ${error.message}`);
      throw error;
    }

    console.log(
      `Retrieved ${users.length} user details out of ${userIds.length} associations`
    );

    // Cache the result
    if (users.length > 0) {
      await setCompanyDetailCache(companyId, users);
      console.log(`Cached ${users.length} users for company ${companyId}`);
    }

    const endTime = Date.now();
    console.log(`Fetched ${users.length} users in ${endTime - startTime}ms`);

    return users;
  } catch (error) {
    console.error(`Error fetching users for company ${companyId}:`, error);
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
