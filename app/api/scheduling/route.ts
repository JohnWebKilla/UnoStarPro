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

    // Get all employees with their schedules
    const { data: employees, error: employeesError } = await supabase
      .from("users")
      .select(
        "id, first_name, last_name, email, role, department, phone_number"
      );

    if (employeesError) {
      console.error("Error fetching employees:", employeesError);
      return new NextResponse(
        JSON.stringify({ error: "Failed to fetch employees" }),
        { status: 500 }
      );
    }

    console.log("Raw database employee data:", employees);

    // Get all schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from("schedules")
      .select("*");

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      return new NextResponse(
        JSON.stringify({ error: "Failed to fetch schedules" }),
        { status: 500 }
      );
    }

    console.log("Raw database schedules data:", schedules);

    // Combine employee and schedule data
    const schedulingData = employees.map((employee) => {
      const schedule = schedules.find((s) => s.user_id === employee.id) || {
        working_shift: "1",
        off_days: ["saturday", "sunday"],
      };

      return {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        phone: employee.phone_number,
        schedule: {
          shift: schedule.working_shift,
          offDays: schedule.off_days,
        },
      };
    });

    return new NextResponse(JSON.stringify(schedulingData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Scheduling API error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
