import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@/types/role";
import { cacheCommonData } from "@/lib/cache-utils";

const getDashboardUrl = (role: Role): string => {
  return "/Dashboard";
};

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const cookieStore = cookies();
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !user) {
      return NextResponse.json(
        { error: "Invalid login credentials" },
        { status: 401 }
      );
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    try {
      // Wait for cache warming to complete before redirecting
      console.log("Starting cache warming for user:", user.id);
      await cacheCommonData(user.id, profile.role);
      console.log("Cache warming completed for user:", user.id);
    } catch (cacheError) {
      // Log the error but continue with sign-in
      console.error("Cache warming error:", cacheError);
    }

    // Get the appropriate dashboard URL based on role
    const dashboardUrl = getDashboardUrl(profile.role);

    return NextResponse.json({
      success: true,
      redirectUrl: dashboardUrl,
      cacheWarmed: true,
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
