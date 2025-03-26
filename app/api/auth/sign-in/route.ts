import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@/types/role";
import { cacheCommonData } from "@/lib/cache-utils";
import { RedisManager } from "@/lib/redis-manager";

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
    // Establish Redis connection first
    try {
      await RedisManager.getConnection();
    } catch (redisError) {
      console.error("Failed to establish Redis connection:", redisError);
      return NextResponse.json(
        { error: "Failed to establish cache connection" },
        { status: 500 }
      );
    }

    // Sign in with Supabase
    const {
      data: { user },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Sign-in authentication error:", signInError);
      return NextResponse.json(
        { error: signInError.message || "Invalid login credentials" },
        { status: 401 }
      );
    }

    if (!user) {
      console.error("No user returned from sign-in");
      return NextResponse.json(
        { error: "Invalid login credentials" },
        { status: 401 }
      );
    }

    // Get user role and other data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
      return NextResponse.json(
        { error: userError.message || "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData) {
      console.error("No user data found for ID:", user.id);
      return NextResponse.json(
        { error: "User data not found" },
        { status: 404 }
      );
    }

    if (!userData.role) {
      console.error("No role found for user:", user.id);
      return NextResponse.json(
        { error: "User role not found" },
        { status: 400 }
      );
    }

    console.log("User data fetched:", {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      name: `${userData.first_name} ${userData.last_name}`,
    });

    // Cache warming
    try {
      console.log(
        "Starting cache warming for user:",
        user.id,
        "with role:",
        userData.role
      );
      await cacheCommonData(user.id, userData.role);
      console.log("Cache warming completed successfully");
    } catch (cacheError) {
      console.error("Cache warming error:", cacheError);
      // Continue with sign-in but log the error
    }

    // Get the appropriate dashboard URL
    const dashboardUrl = getDashboardUrl(userData.role);
    console.log("Redirecting to dashboard:", dashboardUrl);

    return NextResponse.json({
      success: true,
      redirectUrl: dashboardUrl,
      cacheWarmed: true,
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        name: `${userData.first_name} ${userData.last_name}`,
      },
    });
  } catch (error) {
    console.error("Unhandled error during sign-in:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
