import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return new NextResponse(
        JSON.stringify({ error: "Month parameter is required" }),
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse(null, { status: 401 });
    }

    // Parse month parameter to get start and end dates
    const startDate = new Date(month);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of the month

    // Query expenses for the specified month
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startDate.toISOString())
      .lt("date", endDate.toISOString());

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
      return new NextResponse(
        JSON.stringify({ error: "Failed to fetch expenses" }),
        { status: 500 }
      );
    }

    return new NextResponse(JSON.stringify(expenses), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Expenses API error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
