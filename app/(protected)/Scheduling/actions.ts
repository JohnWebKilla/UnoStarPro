"use server";

import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";

export interface SchedulingStats {
  totalEmployees: number;
  activeShifts: number;
  todayAbsences: number;
  error: string | null;
}

export interface Absence {
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

// Cache the scheduling overview for 1 minute
export const getSchedulingOverview = unstable_cache(
  async (startDate: string, endDate: string) => {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc("get_scheduling_overview", {
        start_date: startDate,
        end_date: endDate,
      });

      if (error) throw error;

      return {
        stats: data.stats,
        employees: data.employees || [],
        absences: data.absences || [],
        error: null,
      };
    } catch (error: any) {
      console.error("Error in getSchedulingOverview:", error);
      return {
        stats: {
          totalEmployees: 0,
          activeShifts: 0,
          todayAbsences: 0,
          error: error.message,
        },
        employees: [],
        absences: [],
        error: error.message,
      };
    }
  },
  ["scheduling-overview"],
  {
    revalidate: 60,
    tags: ["scheduling-overview"],
  }
);

export async function getInitialSchedulingData(
  startDate: string,
  endDate: string
) {
  return getSchedulingOverview(startDate, endDate);
}

export async function createAbsence(data: {
  userId: string;
  date: string;
  reason: string;
}) {
  try {
    const supabase = await createClient();

    // Check if absence already exists
    const { data: existingAbsence, error: checkError } = await supabase
      .from("absences")
      .select("id")
      .eq("user_id", data.userId)
      .eq("date", data.date)
      .single();

    if (checkError && checkError.code !== "PGRST116") throw checkError;
    if (existingAbsence) {
      throw new Error("An absence already exists for this date");
    }

    // Create the absence
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

    if (error) throw error;

    return { absence: absence as unknown as Absence, error: null };
  } catch (error: any) {
    console.error("Error creating absence:", error);
    return { absence: null, error: error.message };
  }
}

export async function updateAbsence(
  id: number,
  data: {
    reason: string;
  }
) {
  try {
    const supabase = await createClient();

    const { data: absence, error } = await supabase
      .from("absences")
      .update({ reason: data.reason })
      .eq("id", id)
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

    if (error) throw error;

    return { absence: absence as unknown as Absence, error: null };
  } catch (error: any) {
    console.error("Error updating absence:", error);
    return { absence: null, error: error.message };
  }
}

export async function deleteAbsence(id: number) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("absences").delete().eq("id", id);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error deleting absence:", error);
    return { error: error.message };
  }
}

export async function updateSchedule(
  userId: string,
  data: {
    working_shift: number;
    off_days: string[];
  }
) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("schedules").upsert(
      {
        user_id: userId,
        working_shift: data.working_shift,
        off_days: data.off_days,
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error updating schedule:", error);
    return { error: error.message };
  }
}
