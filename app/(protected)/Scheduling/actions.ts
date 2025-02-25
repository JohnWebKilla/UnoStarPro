"use server";

import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  SchedulingStats,
  Employee,
  Absence,
  Schedule,
  AbsenceFormData,
  ScheduleFormData,
} from "./types";
import { revalidatePath, revalidateTag } from "next/cache";

interface SchedulingOverview {
  stats: SchedulingStats;
  employees: Employee[];
  absences: Absence[];
  schedules: {
    id: number;
    user_id: string;
    working_shift: string;
    off_days: string[];
    created_at: string;
    updated_at: string;
  }[];
  error: string | null;
}

interface AbsenceWithUser {
  id: number;
  user_id: string;
  date: string;
  reason: string;
  created_at: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

class SchedulingError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "SchedulingError";
  }
}

// Cache the scheduling overview for a shorter time and add more specific tags
const getSchedulingOverviewCached = unstable_cache(
  async (
    startDate: string,
    endDate: string,
    supabase: SupabaseClient
  ): Promise<SchedulingOverview> => {
    try {
      // Add timestamp to force fresh data
      const timestamp = Date.now();

      // Fetch all required data in parallel
      const [employeesResult, absencesResult, shiftsResult] = await Promise.all(
        [
          supabase
            .from("users")
            .select(
              "id, first_name, last_name, email, role, department, phone_number"
            )
            .not("role", "eq", "admin"),

          supabase
            .from("absences")
            .select(
              `
            id,
            user_id,
            date,
            reason,
            created_at,
            user:users (
              first_name,
              last_name,
              email
            )
          `
            )
            .gte("date", startDate)
            .lte("date", endDate),

          supabase
            .from("schedules")
            .select("*")
            .order("updated_at", { ascending: false }),
        ]
      );

      // Handle potential errors
      if (employeesResult.error)
        throw new SchedulingError(employeesResult.error.message);
      if (absencesResult.error)
        throw new SchedulingError(absencesResult.error.message);
      if (shiftsResult.error)
        throw new SchedulingError(shiftsResult.error.message);

      const today = format(new Date(), "yyyy-MM-dd");
      const absences = absencesResult.data as unknown as AbsenceWithUser[];

      // Map phone_number to phone in the employees data
      const employeesWithPhone =
        employeesResult.data?.map((employee) => ({
          ...employee,
          phone: employee.phone_number,
        })) || [];

      return {
        stats: {
          totalEmployees: employeesResult.data?.length || 0,
          activeShifts: shiftsResult.data?.length || 0,
          todayAbsences: absences.filter((absence) => absence.date === today)
            .length,
          error: null,
        },
        employees: employeesWithPhone as Employee[],
        absences: absences.map((absence) => ({
          ...absence,
          user: {
            first_name: absence.user.first_name,
            last_name: absence.user.last_name,
            email: absence.user.email,
          },
        })) as Absence[],
        schedules: shiftsResult.data ?? [],
        error: null,
      };
    } catch (error) {
      console.error("Error in getSchedulingOverview:", error);
      return {
        stats: {
          totalEmployees: 0,
          activeShifts: 0,
          todayAbsences: 0,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        employees: [],
        absences: [],
        schedules: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  ["scheduling-overview"],
  {
    revalidate: false, // Disable caching completely
    tags: ["scheduling-overview", "schedules", "absences", "users"],
  }
);

export async function getSchedulingOverview(
  startDate: string,
  endDate: string
): Promise<SchedulingOverview> {
  const supabase = await createClient();
  return getSchedulingOverviewCached(startDate, endDate, supabase);
}

export async function getInitialSchedulingData(
  startDate: string,
  endDate: string
): Promise<SchedulingOverview> {
  const supabase = await createClient();

  try {
    // Get authenticated user data
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("Authentication error:", userError);
      throw new SchedulingError("Authentication failed: " + userError.message);
    }
    if (!userData.user) {
      throw new SchedulingError("No authenticated user found");
    }

    // Get user data with error logging
    const { data: userDetails, error: userDetailsError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (userDetailsError) {
      console.error("User data error:", userDetailsError);
      throw new SchedulingError(
        "Failed to fetch user data: " + userDetailsError.message
      );
    }

    if (!userDetails) {
      throw new SchedulingError("User data not found");
    }

    if (userDetails.role !== "admin") {
      throw new SchedulingError("Admin access required");
    }

    // Fetch all required data in parallel
    const [statsResult, employeesResult, absencesResult, schedulesResult] =
      await Promise.all([
        supabase.from("scheduling_stats_view").select("*").single(),
        supabase
          .from("users")
          .select(
            "id, first_name, last_name, email, role, department, phone_number"
          )
          .not("role", "eq", "admin"),
        supabase
          .from("absences")
          .select(
            `
          id,
          user_id,
          date,
          reason,
          created_at,
          user:users (
            first_name,
            last_name,
            email
          )
        `
          )
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("schedules")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

    // Add error logging for each query
    if (statsResult.error) {
      console.error("Stats query error:", statsResult.error);
    }
    if (employeesResult.error) {
      console.error("Employees query error:", employeesResult.error);
    }
    if (absencesResult.error) {
      console.error("Absences query error:", absencesResult.error);
    }
    if (schedulesResult.error) {
      console.error("Schedules query error:", schedulesResult.error);
    }

    // Map phone_number to phone in the employees data
    const employeesWithPhone =
      employeesResult.data?.map((employee) => ({
        ...employee,
        phone: employee.phone_number,
      })) || [];

    // Log raw employee data from database
    console.log("Raw database employee data:", employeesResult.data);
    console.log("Raw database schedules data:", schedulesResult.data);

    return {
      stats: {
        totalEmployees: statsResult.data?.total_employees ?? 0,
        activeShifts: statsResult.data?.active_shifts ?? 0,
        todayAbsences: statsResult.data?.today_absences ?? 0,
        error: null,
      },
      employees: employeesWithPhone as Employee[],
      absences: (absencesResult.data ?? []).map((absence) => ({
        ...absence,
        user: absence.user?.[0] || { first_name: "", last_name: "", email: "" },
      })) as Absence[],
      schedules: schedulesResult.data ?? [],
      error: null,
    };
  } catch (error) {
    console.error("Error in getInitialSchedulingData:", error);
    return {
      stats: {
        totalEmployees: 0,
        activeShifts: 0,
        todayAbsences: 0,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      employees: [],
      absences: [],
      schedules: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function createAbsence(data: AbsenceFormData) {
  const supabase = await createClient();

  try {
    // Check if absence already exists
    const { data: existingAbsence, error: checkError } = await supabase
      .from("absences")
      .select("id, date")
      .eq("user_id", data.userId)
      .eq("date", data.date)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking for existing absence:", checkError);
      throw new SchedulingError(checkError.message, checkError.code);
    }

    if (existingAbsence) {
      return {
        absence: null,
        error: "An absence already exists for this date",
        code: "DUPLICATE_ABSENCE",
      };
    }

    const { data: absence, error } = await supabase
      .from("absences")
      .insert({
        user_id: data.userId,
        date: data.date,
        reason: data.reason,
      })
      .select(
        `
        *,
        user:users (
          first_name,
          last_name,
          email
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating absence:", error);
      throw new SchedulingError(error.message, error.code);
    }

    return { absence: absence as Absence, error: null, code: null };
  } catch (error) {
    console.error("Error in createAbsence:", error);
    return {
      absence: null,
      error:
        error instanceof SchedulingError
          ? error.message
          : "Failed to create absence",
      code: error instanceof SchedulingError ? error.code : "UNKNOWN_ERROR",
    };
  }
}

export async function updateSchedule(data: ScheduleFormData) {
  const supabase = await createClient();

  try {
    // Get authenticated user data
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("Authentication error:", userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!userData.user) {
      console.error("No authenticated user found");
      throw new Error("No authenticated user found");
    }

    // Verify user has permission to update schedules
    const { data: userDetails, error: userDetailsError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (userDetailsError) {
      throw new Error("Failed to verify user permissions");
    }

    if (!userDetails || userDetails.role !== "admin") {
      throw new Error("Admin access required to update schedules");
    }

    // Update the schedule
    const { error: scheduleError } = await supabase.from("schedules").upsert(
      {
        user_id: data.userId,
        working_shift: data.workingShift,
        off_days: data.offDays,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (scheduleError) throw new Error(scheduleError.message);

    // Revalidate all related caches immediately
    await Promise.all([
      revalidatePath("/Scheduling", "layout"),
      revalidateTag("scheduling-overview"),
      revalidateTag("schedules"),
      revalidateTag(`schedule-${data.userId}`),
      revalidateTag("users"),
    ]);

    return { error: null };
  } catch (error) {
    console.error("Error updating schedule:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to update schedule",
    };
  }
}

export async function deleteAbsence(id: number) {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("absences").delete().eq("id", id);

    if (error) throw new SchedulingError(error.message, error.code);

    return { error: null };
  } catch (error) {
    console.error("Error deleting absence:", error);
    return {
      error:
        error instanceof SchedulingError
          ? error.message
          : "Failed to delete absence",
    };
  }
}

export async function getEmployeeSchedule(
  userId: string
): Promise<Schedule | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new SchedulingError(error.message, error.code);
    }

    return data as Schedule;
  } catch (error) {
    console.error("Error fetching employee schedule:", error);
    return null;
  }
}
