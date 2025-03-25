import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis";

// GET - fetch users (with optional userId filter)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const supabase = await createClient();

    // If userId is provided, fetch specific user
    if (userId) {
      // Fetch user data
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      // Fetch schedule data separately
      const { data: schedule } = await supabase
        .from("schedules")
        .select("working_shift, off_days")
        .eq("user_id", userId)
        .single();

      // Combine user and schedule data
      const combinedUser = {
        ...user,
        working_shift: schedule?.working_shift || null,
        off_days: schedule?.off_days || null,
      };

      return Response.json(combinedUser);
    }

    // Otherwise, fetch all users
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_companies (
          companies (
            id,
            name,
            status
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch all schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from("schedules")
      .select("user_id, working_shift, off_days");

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      // Continue without schedules if there's an error
    }

    // Create a map of schedules by user_id for quick lookup
    const schedulesMap = new Map();
    if (schedules) {
      schedules.forEach((schedule) => {
        schedulesMap.set(schedule.user_id, {
          working_shift: schedule.working_shift,
          off_days: schedule.off_days,
        });
      });
    }

    // Transform the data to include company information and schedules
    const transformedUsers = users.map((user: any) => {
      let assignedCompanies = [];

      // If user has all access, include all active companies
      if (user.has_all_access) {
        // Note: Companies will be fetched client-side for users with all_access
        assignedCompanies = [];
      } else {
        // Get companies from user_companies junction table
        if (user.user_companies && user.user_companies.length > 0) {
          assignedCompanies = user.user_companies
            .map((uc: any) => uc.companies)
            .filter((company: any) => company && company.status === "active");
        }
      }

      // Get schedule data from the map
      const schedule = schedulesMap.get(user.id);

      // Combine user, company, and schedule data
      return {
        ...user,
        working_shift: schedule?.working_shift || null,
        off_days: schedule?.off_days || null,
        companies: assignedCompanies,
      };
    });

    return Response.json(transformedUsers);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST - create new user
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Create auth user first
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: body.email,
      password: body.password || Math.random().toString(36).slice(-8),
      options: {
        data: {
          first_name: body.first_name,
          last_name: body.last_name,
          phone_number: body.phone_number,
          role: body.role,
          status: "pending",
        },
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return Response.json({ error: authError.message }, { status: 500 });
    }
    if (!authUser.user) {
      console.error("No user returned from auth signup");
      return Response.json(
        { error: "No user returned from auth signup" },
        { status: 500 }
      );
    }

    // Extract schedule data
    const { working_shift, off_days, ...userData } = body;

    // Then create the user record
    const { data: user, error: dbError } = await supabase
      .from("users")
      .insert({
        id: authUser.user.id,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone_number: body.phone_number,
        role: body.role,
        status: "pending",
        dob: body.dob,
        department: body.department,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    // Create schedule record if shift data is provided
    if (working_shift || off_days) {
      const scheduleData: {
        user_id: string;
        working_shift: any;
        off_days: any;
        created_at: string;
        updated_at: string;
      } = {
        user_id: user.id,
        working_shift: working_shift || null,
        off_days: off_days || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: scheduleError } = await supabase
        .from("schedules")
        .insert([scheduleData]);

      if (scheduleError) {
        console.error("Error creating schedule:", scheduleError);
        // Continue even if schedule creation fails
      }
    }

    // Return user with schedule data
    return Response.json({
      ...user,
      working_shift: working_shift || null,
      off_days: off_days || null,
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return Response.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

// PUT - update user
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const operation = searchParams.get("operation");

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const body = await request.json();

    // Handle different update operations
    switch (operation) {
      case "status":
        // Update user status
        const { data: statusUser, error: statusError } = await supabase
          .from("users")
          .update({ status: body.status })
          .eq("id", userId)
          .select()
          .single();

        if (statusError) throw statusError;
        return Response.json(statusUser);

      case "companies":
        // Update user's company associations
        const { error: companyError } = await supabase
          .from("users")
          .update({
            has_all_access: body.has_all_access,
            company_id: body.company_id,
          })
          .eq("id", userId);

        if (companyError) throw companyError;

        // Update junction table if needed
        if (!body.has_all_access && body.company_ids) {
          // First remove existing associations
          await supabase.from("user_companies").delete().eq("user_id", userId);

          // Then add new ones
          if (body.company_ids.length > 0) {
            const { error: junctionError } = await supabase
              .from("user_companies")
              .insert(
                body.company_ids.map((companyId: number) => ({
                  user_id: userId,
                  company_id: companyId,
                }))
              );

            if (junctionError) throw junctionError;
          }
        }

        return Response.json({ success: true });

      default:
        // Regular user update
        // Extract schedule data from the body
        const { working_shift, off_days, ...userData } = body;

        // Update user data
        const { data: user, error } = await supabase
          .from("users")
          .update(userData)
          .eq("id", userId)
          .select()
          .single();

        if (error) throw error;

        // Check if schedule data is provided
        if (working_shift !== undefined || off_days !== undefined) {
          // First check if a schedule record exists for this user
          const { data: existingSchedule } = await supabase
            .from("schedules")
            .select("id")
            .eq("user_id", userId)
            .single();

          // Define schedule data with proper typing
          const scheduleData: {
            user_id: string;
            working_shift: any;
            off_days: any;
            updated_at: string;
            created_at?: string;
          } = {
            user_id: userId,
            working_shift: working_shift,
            off_days: off_days,
            updated_at: new Date().toISOString(),
          };

          if (existingSchedule) {
            // Update existing schedule
            const { error: scheduleError } = await supabase
              .from("schedules")
              .update(scheduleData)
              .eq("user_id", userId);

            if (scheduleError) {
              console.error("Error updating schedule:", scheduleError);
            }
          } else {
            // Create new schedule
            scheduleData.created_at = new Date().toISOString();
            const { error: scheduleError } = await supabase
              .from("schedules")
              .insert([scheduleData]);

            if (scheduleError) {
              console.error("Error creating schedule:", scheduleError);
            }
          }
        }

        // Return user with schedule data
        return Response.json({
          ...user,
          working_shift,
          off_days,
        });
    }
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE - delete user
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Delete user's schedule record
    await supabase.from("schedules").delete().eq("user_id", userId);

    // Delete user's company associations
    await supabase.from("user_companies").delete().eq("user_id", userId);

    // Then delete the user
    const { error } = await supabase.from("users").delete().eq("id", userId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
