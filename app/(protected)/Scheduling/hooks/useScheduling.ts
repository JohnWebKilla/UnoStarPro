import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import {
  getInitialSchedulingData,
  createAbsence,
  updateSchedule,
  deleteAbsence,
  getEmployeeSchedule,
} from "../actions";
import type {
  AbsenceFormData,
  ScheduleFormData,
  Schedule,
  SchedulingStats,
  Employee,
  Absence,
} from "../types";

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
}

export function useSchedulingData(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: schedulingKeys.overview(
      format(start, "yyyy-MM-dd"),
      format(end, "yyyy-MM-dd")
    ),
    queryFn: async () => {
      const result = await getInitialSchedulingData(
        format(start, "yyyy-MM-dd"),
        format(end, "yyyy-MM-dd")
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        stats: {
          totalEmployees: result.stats?.totalEmployees ?? 0,
          activeShifts: result.stats?.activeShifts ?? 0,
          todayAbsences: result.stats?.todayAbsences ?? 0,
          error: null,
        },
        employees: result.employees ?? [],
        absences: result.absences ?? [],
        schedules: result.schedules ?? [],
        error: null,
      };
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
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
