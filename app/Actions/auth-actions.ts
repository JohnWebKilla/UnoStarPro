"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardForRole } from "@/utils/protected";
import type { Role } from "@/types/role";
import { ClientCacheManager } from "@/lib/client-cache-manager";
import { revalidatePath } from "next/cache";

export async function signUpAction(formData: FormData) {
  const supabase = await createClient();
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;
    const phone_number = formData.get("phone_number") as string;
    const avatar = formData.get("avatar") as string;

    if (!email || !password || !first_name || !last_name || !phone_number) {
      return "error:All fields are required";
    }

    // Create auth user first with combined name as display name
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${first_name} ${last_name}`,
          phone: phone_number,
          avatar_url: avatar || "",
        },
      },
    });

    if (signUpError || !authData.user) {
      return `error:${signUpError?.message || "Sign up failed"}`;
    }

    console.log("Auth signup successful, user ID:", authData.user.id);

    // Insert user data with separate first and last names
    const { error: insertError } = await supabase.from("users").insert({
      id: authData.user.id,
      first_name,
      last_name,
      phone: phone_number,
      role: "customer",
      created_at: new Date().toISOString(),
      avatar_url: avatar || "",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      // If user data insertion fails, attempt to delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return `error:${insertError.message}`;
    }

    // Verify user data was properly inserted
    const { data: verifyData, error: verifyError } = await supabase
      .from("users")
      .select()
      .eq("id", authData.user.id)
      .single();

    if (verifyError || !verifyData) {
      // If verification fails, attempt to delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return `error:Failed to verify user data creation`;
    }

    redirect("/sign-in");
  } catch (error) {
    return `error:${error instanceof Error ? error.message : "An error occurred"}`;
  }
}

type SignInResult =
  | {
      success: true;
      role: string;
      dashboardUrl: string;
      user: {
        name: string;
        role: string;
        email: string;
      };
    }
  | { error: string; success?: never }
  | undefined;

export async function signIn(email: string, password: string) {
  console.log("Attempting sign in for email:", email);

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;
    if (!user) throw new Error("No user returned from sign in");

    console.log("Auth successful, user ID:", user.id);

    // Get user data including role
    let { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    // If user data doesn't exist, create it
    if (userError?.code === "PGRST116") {
      console.log("User record not found, creating one...");

      // Extract name parts from email or user metadata
      const nameParts = user.user_metadata?.full_name?.split(" ") ||
        email.split("@")[0].split(".") || ["User", user.id.slice(0, 8)];

      const first_name = nameParts[0] || "User";
      const last_name = nameParts[1] || user.id.slice(0, 8);

      const newUserData = {
        id: user.id,
        email: user.email,
        first_name,
        last_name,
        role: "customer", // Default role
        status: "active",
        created_at: new Date().toISOString(),
        has_all_access: false,
        payment_frequency: "monthly",
        department: "general",
        company_id: 1, // Default company ID
      };

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert(newUserData)
        .select()
        .single();

      if (insertError) {
        console.error("Error creating user record:", insertError);
        throw insertError;
      }

      userData = newUser;
    } else if (userError) {
      console.error("Error fetching user data:", userError);
      throw userError;
    }

    if (!userData) throw new Error("No user data found");

    // Initialize cache manager with user's role
    const cacheManager = new ClientCacheManager(userData.role);

    // Get dashboard URL based on role
    const dashboardUrl = getDashboardForRole(userData.role as Role);
    console.log("Dashboard URL for role:", {
      role: userData.role,
      dashboardUrl,
    });

    try {
      // Start prefetching all data
      await cacheManager.prefetchAllData();

      return {
        success: true,
        dashboardUrl,
        userData: {
          role: userData.role,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          status: userData.status,
        },
      };
    } catch (error) {
      console.error("Cache prefetch error:", error);
      // Continue with login even if prefetch fails
      return {
        success: true,
        dashboardUrl,
        userData: {
          role: userData.role,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          status: userData.status,
        },
      };
    }
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin");

  if (!email) {
    return "error:Email is required";
  }

  if (!origin) {
    return "error:Invalid request origin";
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Password reset error:", error);
    return `error:${error.message}`;
  }

  return { success: true };
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return "error:Password and confirm password are required";
  }

  if (password !== confirmPassword) {
    return "error:Passwords do not match";
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return `error:${error.message}`;
  }

  return { success: true };
};

export async function signOutAction() {
  try {
    const supabase = await createClient();

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }

    // Return success response
    return { success: true };
  } catch (error) {
    console.error("Sign-out error:", error);
    return { success: false, error: "Failed to sign out" };
  }
}
