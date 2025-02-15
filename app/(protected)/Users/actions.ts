"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { User, UserRole } from "./types";

interface Company {
  id: number;
  name: string;
  status: string;
}

interface UserCompanyJunction {
  companies: Company;
}

interface UserWithCompanies extends User {
  user_companies?: UserCompanyJunction[];
  companies?: Company[];
}

export async function getUsers() {
  try {
    const supabase = await createClient();

    // Get all users with their company associations using left join
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

    if (error) throw error;

    // Get all active companies for lookup
    const { data: allCompanies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("status", "active");

    if (companiesError) throw companiesError;

    // Transform the data to include company information
    const transformedUsers = (users as UserWithCompanies[]).map((user) => {
      let assignedCompanies: Company[] = [];

      // If user has all access, include all active companies
      if (user.has_all_access) {
        assignedCompanies = allCompanies || [];
      } else {
        // Get companies from user_companies junction table
        if (user.user_companies && user.user_companies.length > 0) {
          assignedCompanies = user.user_companies
            .map((uc: any) => uc.companies)
            .filter((company) => company && company.status === "active");
        }

        // If user has a legacy company_id, add it to the list if not already included
        if (user.company_id) {
          const legacyCompanyExists = assignedCompanies.some(
            (c) => c.id === user.company_id
          );
          if (!legacyCompanyExists) {
            const legacyCompany = allCompanies?.find(
              (c) => c.id === user.company_id
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
    });

    return { users: transformedUsers, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { users: [], error: "Failed to fetch users" };
  }
}

export async function createUser(formData: FormData) {
  try {
    const supabase = await createClient();

    // First create the auth user
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      options: {
        data: {
          first_name: formData.get("first_name"),
          last_name: formData.get("last_name"),
          phone_number: formData.get("phone_number"),
          role: formData.get("role"),
          status: "pending",
          dob: formData.get("dob"),
        },
      },
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("No user returned from auth signup");

    // Then add the user to the users table
    const { error: insertError } = await supabase.from("users").insert({
      id: authUser.user.id,
      email: authUser.user.email,
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      phone_number: formData.get("phone_number"),
      role: formData.get("role"),
      status: "pending",
      dob: formData.get("dob"),
      created_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    revalidatePath("/Users");
    return { user: authUser, error: null };
  } catch (error) {
    console.error("Error creating user:", error);
    return { user: null, error: "Failed to create user" };
  }
}

export async function updateUser(formData: FormData) {
  try {
    const supabase = await createClient();
    const userId = formData.get("id") as string;
    const newRole = formData.get("role") as string;

    // Get current user data to check role
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (fetchError) throw fetchError;

    // Check if role is being changed from admin to non-admin
    const isRoleDowngrade = currentUser.role === "admin" && newRole !== "admin";

    // First update the user metadata in auth
    const { data: authUpdate, error: authError } =
      await supabase.auth.updateUser({
        data: {
          first_name: formData.get("first_name"),
          last_name: formData.get("last_name"),
          phone_number: formData.get("phone_number"),
          role: newRole,
          dob: formData.get("dob"),
        },
      });

    if (authError) throw authError;

    // Prepare update data
    const updateData: {
      first_name: FormDataEntryValue | null;
      last_name: FormDataEntryValue | null;
      phone_number: FormDataEntryValue | null;
      role: string;
      dob: FormDataEntryValue | null;
      company_id?: null;
      has_all_access?: boolean;
    } = {
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      phone_number: formData.get("phone_number"),
      role: newRole,
      dob: formData.get("dob"),
    };

    // If role is downgraded from admin, reset company access
    if (isRoleDowngrade) {
      updateData.company_id = null;
      updateData.has_all_access = false;
    }

    // Then update the users table
    const { data: user, error: dbError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (dbError) throw dbError;

    // Return the user data in the correct format
    return {
      user: {
        user: user, // The database user already matches our User interface
      },
      error: null,
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return { user: null, error: "Failed to update user" };
  }
}

export async function updateUserStatus(userId: string, status: string) {
  try {
    const supabase = await createClient();

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
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId);

    if (error) throw error;

    return { companies: data.map((d) => d.company_id), error: null };
  } catch (error) {
    console.error("Error fetching user companies:", error);
    return { companies: [], error: "Failed to fetch user companies" };
  }
}

export async function updateUserCompanies(
  userId: string,
  companyIds: string[]
) {
  try {
    const supabase = await createClient();

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
    const supabase = await createClient();

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

// Update the getUserAccessibleCompanies function to handle multiple companies
export async function getUserAccessibleCompanies(userId: string) {
  try {
    const supabase = await createClient();

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
      .select("companies(*)")
      .eq("user_id", userId)
      .eq("companies.status", "active");

    if (userCompaniesError) throw userCompaniesError;

    const companies = userCompanies
      .map((uc) => uc.companies)
      .filter((company) => company !== null);

    return { companies, single: false };
  } catch (error: any) {
    console.error("Error getting user companies:", error);
    return { error: error.message };
  }
}
