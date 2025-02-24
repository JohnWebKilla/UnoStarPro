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

// Add this interface near the top with other types
interface SchedulingData {
  stats: SchedulingStats;
  employees: Employee[];
  absences: Absence[];
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
        error: null,
      };
    },
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    retry: 1, // Only retry once on failure
  });
}

export function useEmployeeSchedule(userId: string) {
  return useQuery({
    queryKey: schedulingKeys.employeeSchedule(userId),
    queryFn: () => getEmployeeSchedule(userId),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AbsenceFormData) => createAbsence(data),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
  });
}

export function useUpdateSchedule(): UseMutationResult<
  { error: null } | { error: string },
  Error,
  ScheduleFormData,
  { previousData: any }
> {
  const queryClient = useQueryClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

  return useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const result = await updateSchedule(data);
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: schedulingKeys.all });
      await queryClient.cancelQueries({
        queryKey: schedulingKeys.overview(start, end),
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(
        schedulingKeys.overview(start, end)
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onSuccess: (_data, variables) => {
      // Invalidate and refetch all scheduling queries
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.overview(start, end),
      });
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.employeeSchedule(variables.userId),
      });
    },
    onError: (_error, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          schedulingKeys.overview(start, end),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.overview(start, end),
      });
    },
  });
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation<
    { error: null } | { error: string },
    Error,
    number,
    { previousAbsences: Absence[] }
  >({
    mutationFn: async (id: number) => {
      const result = await deleteAbsence(id);
      return result;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: schedulingKeys.all });
      const previousAbsences =
        queryClient.getQueryData<Absence[]>(schedulingKeys.all) || [];
      return { previousAbsences };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
  });
}

// Helper function to get current stats from cache
export function useCurrentStats(): SchedulingStats | undefined {
  const queryClient = useQueryClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const data = queryClient.getQueryData<SchedulingData>(
    schedulingKeys.overview(start, end)
  );
  return data?.stats;
}

// Helper function to get employees from cache
export function useEmployees(): Employee[] | undefined {
  const queryClient = useQueryClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const data = queryClient.getQueryData<SchedulingData>(
    schedulingKeys.overview(start, end)
  );
  return data?.employees;
}

// Helper function to get absences from cache
export function useAbsences(): Absence[] | undefined {
  const queryClient = useQueryClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const data = queryClient.getQueryData<SchedulingData>(
    schedulingKeys.overview(start, end)
  );
  return data?.absences;
}
