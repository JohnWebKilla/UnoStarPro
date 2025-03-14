"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardForRole } from "@/utils/protected";
import type { Role } from "@/types/role";

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

export const signInAction = async (
  formData: FormData
): Promise<SignInResult> => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  try {
    console.log("Attempting sign in for email:", email);
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user || !authData.user.email) {
      console.error("Auth error:", authError);
      return { error: authError?.message || "Authentication failed" };
    }

    console.log("Auth successful, user ID:", authData.user.id);

    // Now we know authData.user.email is defined
    const userEmail = authData.user.email;

    // Fetch complete user data including role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, first_name, last_name")
      .eq("id", authData.user.id)
      .single();

    console.log("User data query result:", { userData, userError });

    if (userError || !userData) {
      console.error("User data error:", userError);
      return { error: "Failed to fetch user data" };
    }

    // Get the appropriate dashboard URL based on role
    const dashboardUrl = getDashboardForRole(userData.role as Role);
    console.log("Dashboard URL for role:", {
      role: userData.role,
      dashboardUrl,
    });

    if (dashboardUrl === "/unauthorized") {
      return { error: "Invalid user role or permissions" };
    }

    return {
      success: true,
      role: userData.role,
      dashboardUrl,
      user: {
        name: `${userData.first_name} ${userData.last_name}`,
        role: userData.role,
        email: userEmail,
      },
    };
  } catch (error) {
    console.error("Sign-in error:", error);
    return { error: "An unexpected error occurred" };
  }
};

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

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
