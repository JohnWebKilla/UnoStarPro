"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardForRole } from "@/utils/protected";
import type { Role } from "@/types/role";
import { revalidatePath } from "next/cache";
import { getDashboardUrl } from "@/lib/get-dashboard-url";
import { clearDriverListCache } from "@/app/(protected)/Drivers/cache";

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
      userData: {
        role: Role;
        first_name: string;
        last_name: string;
      };
      dashboardUrl: string;
    }
  | { success: false; error: string }
  | undefined;

export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
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

    if (signInError || !user) {
      return {
        success: false,
        error: signInError?.message || "No user returned from sign in",
      };
    }

    // Verify session is active
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("Failed to verify session after sign in:", sessionError);
      return {
        success: false,
        error: "Failed to establish session",
      };
    }

    // Get user data from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return {
        success: false,
        error: userError?.message || "No user data found",
      };
    }

    const role = userData.role || "customer";
    const dashboardUrl = getDashboardUrl(role);
    console.log("Dashboard URL for role:", { role, dashboardUrl });

    // Cache nav data immediately
    const navData = {
      userRole: role as Role,
      userName: `${userData.first_name} ${userData.last_name}`,
      userEmail: session.user.email || null,
    };

    // Only access localStorage in browser environment
    if (typeof window !== "undefined") {
      localStorage.setItem("navData", JSON.stringify(navData));
    }

    return {
      success: true,
      userData: {
        role: role as Role,
        first_name: userData.first_name,
        last_name: userData.last_name,
      },
      dashboardUrl,
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid credentials",
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

    // Clear the driver cache on logout
    try {
      await clearDriverListCache(true); // Force clear the cache
      console.log("Driver cache cleared on logout");
    } catch (cacheError) {
      console.error("Error clearing driver cache on logout:", cacheError);
      // Continue with logout even if cache clearing fails
    }

    // Return success response
    return { success: true };
  } catch (error) {
    console.error("Sign-out error:", error);
    return { success: false, error: "Failed to sign out" };
  }
}
