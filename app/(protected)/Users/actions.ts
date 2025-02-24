"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { User, UserRole } from "./types";
import { Database } from "@/types/supabase";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type UserCompanyJunction = {
  companies: Company;
};

interface UserWithCompanies extends User {
  user_companies?: UserCompanyJunction[];
  companies?: Company[];
}

export async function getUsers() {
  try {
    const supabase = createClient();

    // Get all users with their company associations using left join
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_companies (
          companies (
            *
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get all active companies for lookup
    const { data: allCompanies, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .eq("status", "active");

    if (companiesError) throw companiesError;

    // Transform the data to include company information
    const transformedUsers = (users as unknown as UserWithCompanies[]).map(
      (user) => {
        let assignedCompanies: Company[] = [];

        // If user has all access, include all active companies
        if (user.has_all_access) {
          assignedCompanies = allCompanies || [];
        } else {
          // Get companies from user_companies junction table
          if (user.user_companies && user.user_companies.length > 0) {
            assignedCompanies = user.user_companies
              .map((uc: UserCompanyJunction) => uc.companies)
              .filter((company): company is Company => company !== null);
          }

          // If user has a legacy company_id, add it to the list if not already included
          if (user.company_id) {
            const legacyCompanyExists = assignedCompanies.some(
              (c: Company) => c.id === user.company_id
            );
            if (!legacyCompanyExists) {
              const legacyCompany = allCompanies?.find(
                (c: Company) => c.id === user.company_id
              );
              if (legacyCompany) {
                assignedCompanies.push(legacyCompany);
              }
            }
          }
        }

        // For debugging
        console.log("User:", user.email, "Companies:", assignedCompanies);

        return {
          ...user,
          companies: assignedCompanies,
        };
      }
    );

    return { users: transformedUsers, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { users: [], error: "Failed to fetch users" };
  }
}

function generatePassword(length = 12) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function createUser(formData: FormData) {
  try {
    const supabase = createClient();

    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;
    const email = formData.get("email") as string;
    const phone_number = formData.get("phone_number") as string;
    const role = formData.get("role") as string;
    const password = formData.get("password") as string;
    const dob = formData.get("dob") as string;
    const working_shift = (formData.get("working_shift") as string) || "1";
    const off_days = JSON.parse(
      (formData.get("off_days") as string) || '["saturday", "sunday"]'
    );

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: password || generatePassword(),
      options: {
        data: {
          first_name,
          last_name,
          phone_number,
          role,
          dob,
          working_shift,
          off_days,
        },
      },
    });

    if (authError) throw authError;

    // Create initial schedule
    if (authData.user) {
      const { error: scheduleError } = await supabase.from("schedules").insert({
        user_id: authData.user.id,
        working_shift,
        off_days,
      });

      if (scheduleError) throw scheduleError;
    }

    return { user: authData };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateUser(formData: FormData) {
  try {
    const supabase = createClient();

    const id = formData.get("id") as string;
    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;
    const email = formData.get("email") as string;
    const phone_number = formData.get("phone_number") as string;
    const role = formData.get("role") as string;
    const dob = formData.get("dob") as string;
    const working_shift = (formData.get("working_shift") as string) || "1";
    const off_days = JSON.parse(
      (formData.get("off_days") as string) || '["saturday", "sunday"]'
    );

    // Get current user data
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("email")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    // Only include email in the update if it has changed
    const updateData: {
      email?: string;
      data: {
        first_name: string;
        last_name: string;
        phone_number: string;
        role: string;
        dob: string;
        working_shift: string;
        off_days: string[];
      };
    } = {
      data: {
        first_name,
        last_name,
        phone_number,
        role,
        dob,
        working_shift,
        off_days,
      },
    };

    // Only include email if it has changed
    if (currentUser.email !== email) {
      updateData.email = email;
    }

    // Update user metadata
    const { data: userData, error: userError } =
      await supabase.auth.updateUser(updateData);

    if (userError) throw userError;

    // Create or update schedule
    const { error: scheduleError } = await supabase.from("schedules").upsert(
      {
        user_id: id,
        working_shift,
        off_days,
      },
      { onConflict: "user_id" }
    );

    if (scheduleError) throw scheduleError;

    return { user: userData };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateUserStatus(userId: string, status: string) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { user: data, error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getUserCompanies(userId: string) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId);

    if (error) throw error;

    return {
      companies: data.map((d: { company_id: number }) => d.company_id),
      error: null,
    };
  } catch (error) {
    console.error("Error fetching user companies:", error);
    return { companies: [], error: "Failed to fetch user companies" };
  }
}

export async function updateUserCompanies(
  userId: string,
  companyIds: number[]
) {
  try {
    const supabase = createClient();

    // First, remove all existing associations
    await supabase.from("user_companies").delete().eq("user_id", userId);

    // Then, add new associations
    if (companyIds.length > 0) {
      const { error } = await supabase.from("user_companies").insert(
        companyIds.map((companyId) => ({
          user_id: userId,
          company_id: companyId,
        }))
      );

      if (error) throw error;
    }

    return { error: null };
  } catch (error) {
    console.error("Error updating user companies:", error);
    return { error: "Failed to update user companies" };
  }
}

export async function updateUserCompanyAccess(
  userId: string,
  companyIds: number[] | null,
  hasAllAccess: boolean
) {
  try {
    const supabase = createClient();

    // Verify user role allows this change
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError) throw new Error("User not found");

    // Only admins can have all access
    if (hasAllAccess && user.role !== "admin") {
      throw new Error("Only admins can have all company access");
    }

    // If setting specific companies, verify they exist and are active
    if (companyIds && companyIds.length > 0) {
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, status")
        .in("id", companyIds)
        .eq("status", "active");

      if (companiesError) throw companiesError;

      // Check if all requested companies were found and are active
      if (!companies || companies.length !== companyIds.length) {
        throw new Error("One or more companies are invalid or inactive");
      }
    }

    // Begin transaction
    // 1. Update user's all_access status and set primary company if single company
    const { error: updateError } = await supabase
      .from("users")
      .update({
        has_all_access: hasAllAccess,
        // If only one company is selected, set it as the primary company
        company_id:
          !hasAllAccess && companyIds?.length === 1 ? companyIds[0] : null,
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    // 2. Remove existing company associations
    const { error: deleteError } = await supabase
      .from("user_companies")
      .delete()
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    // 3. Add new company associations if not has_all_access and companies are specified
    if (!hasAllAccess && companyIds && companyIds.length > 0) {
      const { error: insertError } = await supabase
        .from("user_companies")
        .insert(
          companyIds.map((companyId) => ({
            user_id: userId,
            company_id: companyId,
          }))
        );

      if (insertError) throw insertError;
    }

    revalidatePath("/Users");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating user company access:", error);
    return { error: error.message };
  }
}

export async function getUserAccessibleCompanies(userId: string) {
  try {
    const supabase = createClient();

    // First get user's access level
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("has_all_access, role")
      .eq("id", userId)
      .single();

    if (userError) throw new Error("User not found");

    // If user has all access, return all active companies
    if (user.has_all_access) {
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (companiesError) throw companiesError;
      return { companies, single: false };
    }

    // Get user's assigned companies from junction table
    const { data: userCompanies, error: userCompaniesError } = await supabase
      .from("user_companies")
      .select("companies:companies(*)")
      .eq("user_id", userId)
      .eq("companies.status", "active");

    if (userCompaniesError) throw userCompaniesError;

    // Type assertion to help TypeScript understand the structure
    type UserCompanyResponse = { companies: Company };
    const companies = (userCompanies as unknown as UserCompanyResponse[])
      .map((uc) => uc.companies)
      .filter((company): company is Company => company !== null);

    return { companies, single: false };
  } catch (error: any) {
    console.error("Error getting user companies:", error);
    return { error: error.message };
  }
}

export async function updateUserPayrollBase(
  userId: string,
  data: {
    base_salary: number;
    currency?: string;
    payment_frequency?: "monthly" | "bi-weekly" | "weekly";
  }
) {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("payroll_base")
      .upsert({
        user_id: userId,
        base_salary: data.base_salary,
        currency: data.currency || "USD",
        payment_frequency: data.payment_frequency || "monthly",
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error updating payroll base:", error);
    return { success: false, error: "Failed to update payroll base" };
  }
}
