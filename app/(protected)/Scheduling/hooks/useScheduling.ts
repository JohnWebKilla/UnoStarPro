import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import {
  createAbsence,
  updateSchedule,
  deleteAbsence,
  getEmployeeSchedule,
} from "../actions";
import {
  getSchedulingData,
  clearSchedulingCaches,
} from "../actions/client-actions";
import type {
  AbsenceFormData,
  ScheduleFormData,
  Schedule,
  SchedulingStats,
  Employee,
  Absence,
} from "../types";
import { useState, useCallback } from "react";

// Query keys
export const schedulingKeys = {
  all: ["scheduling"] as const,
  overview: (startDate: string, endDate: string) =>
    [...schedulingKeys.all, "overview", startDate, endDate] as const,
  employeeSchedule: (userId: string) =>
    [...schedulingKeys.all, "employee", userId] as const,
};

interface SchedulingData {
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
  dataSource?: "cache" | "database";
  timing?: {
    total: number;
    database?: number;
    source?: string;
  };
}

export function useSchedulingData(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);

  const queryResult = useQuery({
    queryKey: schedulingKeys.overview(
      format(start, "yyyy-MM-dd"),
      format(end, "yyyy-MM-dd")
    ),
    queryFn: async () => {
      try {
        // Use our client-side caching implementation
        const result = await getSchedulingData(start, end, false);

        // Update state with timing and source information
        setDataSource(result.source);
        setTimingInfo(result.timing);

        console.log(
          `Loaded scheduling data from ${result.source} in ${result.timing.total.toFixed(0)}ms`
        );

        return {
          ...result.data,
          dataSource: result.source,
          timing: result.timing,
        };
      } catch (error) {
        console.error("Error in useSchedulingData:", error);
        return {
          stats: {
            totalEmployees: 0,
            activeShifts: 0,
            todayAbsences: 0,
            error: error instanceof Error ? error.message : String(error),
          },
          employees: [],
          absences: [],
          schedules: [],
          dataSource: "database",
          timing: null,
        };
      }
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const refetch = useCallback(
    async (skipCache: boolean = false) => {
      try {
        // Use our client-side caching implementation with skipCache option
        const result = await getSchedulingData(start, end, skipCache);

        // Update state with timing and source information
        setDataSource(result.source);
        setTimingInfo(result.timing);

        console.log(
          `Refreshed scheduling data from ${result.source} in ${result.timing.total.toFixed(0)}ms`
        );

        // Tell React Query to refetch
        await queryResult.refetch();

        return result;
      } catch (error) {
        console.error("Error refreshing scheduling data:", error);
        throw error;
      }
    },
    [start, end, queryResult]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearSchedulingCaches({ start, end });
      return refetch(true);
    } catch (error) {
      console.error("Error clearing scheduling cache:", error);
      throw error;
    }
  }, [start, end, refetch]);

  return {
    ...queryResult,
    dataSource,
    timingInfo,
    refetch,
    clearCache,
  };
}

// New hook to get employees data
export function useEmployees() {
  const { data, isLoading, error } = useSchedulingData();

  return {
    employees: data?.employees ?? [],
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
  };
}

// New hook to get absences data
export function useAbsences() {
  const { data, isLoading, error } = useSchedulingData();

  return {
    absences: data?.absences ?? [],
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
  };
}

export function useEmployeeSchedule(userId: string) {
  return useQuery({
    queryKey: schedulingKeys.employeeSchedule(userId),
    queryFn: () => getEmployeeSchedule(userId),
    staleTime: 0, // Always fetch fresh data
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAbsence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
  });
}

export function useUpdateSchedule(): UseMutationResult<
  { error: null } | { error: string },
  Error,
  ScheduleFormData,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
  });
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation<{ error: null } | { error: string }, Error, number>({
    mutationFn: deleteAbsence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
  });
}
