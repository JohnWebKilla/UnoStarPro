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
import { getDashboardUrl } from "@/lib/get-dashboard-url";
import { prefetchData } from "@/lib/prefetch-data";

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

    if (signInError || !user) {
      throw signInError || new Error("No user returned from sign in");
    }

    // Try to get role from profiles first
    let role = "customer"; // Default role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      role = profile.role;
    } else {
      // Fallback to users table if no profile exists
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userData?.role) {
        role = userData.role;

        // Create profile with role from users table
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          role: userData.role,
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error("Error creating profile:", insertError);
        }
      } else {
        // Create default profile
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          role: "customer", // Default role
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error("Error creating profile:", insertError);
        }
      }
    }

    const dashboardUrl = getDashboardUrl(role);
    console.log("Dashboard URL for role:", { role, dashboardUrl });

    // Prefetch data based on role
    await prefetchData(supabase, role);

    return { success: true, dashboardUrl };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Invalid credentials" };
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
