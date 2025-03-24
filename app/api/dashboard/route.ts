import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user's session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    // Try to get data from cache first
    const cacheKey = `dashboard:${session.user.id}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const role = userData.role;
    const data: any = {
      stats: {},
      recentActivity: [],
    };

    // Fetch data based on role
    switch (role) {
      case "admin":
      case "superadmin":
        const { data: countData } = await supabase
          .from("users")
          .select("count", { count: "exact", head: true });
        const { data: recentUsers } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        data.stats.totalUsers = countData || 0;
        data.recentActivity = recentUsers;
        break;

      case "customer":
      case "user":
      case "driver":
        const { data: profileData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();
        data.profile = profileData;
        break;
    }

    // Cache the data for 5 minutes
    await setCache(cacheKey, data, 300);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
