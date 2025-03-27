import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse(null, { status: 401 });
    }

    // Get user data including role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
      return new NextResponse(null, { status: 401 });
    }

    // Get counts for various entities
    const [
      { count: companiesCount },
      { count: driversCount },
      { count: usersCount },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "driver"),
      supabase.from("users").select("*", { count: "exact", head: true }),
    ]);

    // Get recent activities
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (activitiesError) {
      console.error("Error fetching activities:", activitiesError);
    }

    // Get current month's expenses
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount")
      .gte("date", startOfMonth.toISOString())
      .lt("date", endOfMonth.toISOString());

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
    }

    const totalExpenses =
      expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

    // Prepare dashboard data based on user role
    const dashboardData = {
      stats: {
        companies: companiesCount,
        drivers: driversCount,
        users: usersCount,
        expenses: totalExpenses,
      },
      recentActivities: activities || [],
      role: userData.role,
    };

    return new NextResponse(JSON.stringify(dashboardData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
