import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");

    if (!startMonth || !endMonth) {
      return new NextResponse(
        JSON.stringify({
          error: "Start and end month parameters are required",
        }),
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

    // Parse month parameters to get start and end dates
    const startDate = new Date(startMonth);
    const endDate = new Date(endMonth);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of the month

    // Query expenses for the date range
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

    // Group expenses by month
    const monthlyExpenses = expenses?.reduce((acc: any, expense) => {
      const month = new Date(expense.date).toISOString().slice(0, 7);
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += expense.amount;
      return acc;
    }, {});

    return new NextResponse(JSON.stringify(monthlyExpenses), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Expenses chart API error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
