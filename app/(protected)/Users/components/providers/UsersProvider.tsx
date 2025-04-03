"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { setupUsersSubscription, RealtimePayload } from "../../realtime";
import { usersDB } from "@/app/(protected)/Users/lib/indexdb";
import { User, Company } from "../../lib/types/types";
import { getUsers, clearUserCaches } from "../../lib/actions/optimized-actions";
import { useRouter } from "next/navigation";

interface TimingInfo {
  total: number;
  database?: number;
  source: string;
}

interface UserCompanyJoin {
  companies: {
    id: number;
    name: string;
    status: string;
  };
}

interface UsersContextType {
  users: User[];
  companies: Company[];
  loading: boolean;
  error: Error | null;
  dataSource: string;
  timingInfo?: TimingInfo;
  refreshUsers: (skipCache?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<User>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [dataSource, setDataSource] = useState<string>("Loading...");
  const [timingInfo, setTimingInfo] = useState<TimingInfo>();
  const { toast } = useToast();
  const supabase = createClient();

  const updateUsersState = (
    newUsers: User[],
    source: string,
    timing?: TimingInfo
  ) => {
    setUsers(newUsers);
    setDataSource(source);
    setTimingInfo(timing);
    setLoading(false);
  };

  const updateCompaniesState = (newCompanies: Company[]) => {
    setCompanies(newCompanies);
  };

  const cleanupDatabase = async () => {
    try {
      await usersDB.clearAll();
      toast({
        title: "Cache cleared",
        description: "Database has been reset due to version mismatch",
      });
    } catch (err) {
      console.error("Error cleaning up database:", err);
    }
  };

  const fetchCompanies = async () => {
    try {
      // Try to get companies from IndexedDB first
      const cachedCompanies = await usersDB.getCompanies();
      if (
        cachedCompanies.length > 0 &&
        cachedCompanies.every((c) => "status" in c)
      ) {
        updateCompaniesState(cachedCompanies);
        return;
      }

      // If not in cache, fetch from API
      const { data: fetchedCompanies, error } = await supabase
        .from("companies")
        .select("id, name, status");

      if (error) throw error;

      // Ensure the companies match the required type
      const typedCompanies: Company[] = (fetchedCompanies || []).map(
        (company) => ({
          id: company.id,
          name: company.name,
          status: company.status || "active", // Ensure status is always set
        })
      );

      // Cache the results
      await usersDB.setCompanies(typedCompanies);
      updateCompaniesState(typedCompanies);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch companies")
      );
    }
  };

  const fetchUsers = useCallback(
    async (skipCache = false) => {
      try {
        const startTime = performance.now();

        if (!skipCache) {
          const cachedUsers = await usersDB.getAllUsers();
          if (cachedUsers.length > 0) {
            const endTime = performance.now();
            updateUsersState(cachedUsers, "IndexedDB", {
              total: endTime - startTime,
              source: "indexeddb",
            });
            return;
          }
        }

        setLoading(true);
        setDataSource("Loading...");

        // First, fetch users
        console.log("Fetching users...");
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("*");

        if (usersError) {
          console.error("Supabase users query error details:", {
            message: usersError.message,
            details: usersError.details,
            hint: usersError.hint,
            code: usersError.code,
          });
          throw usersError;
        }

        if (!users) {
          console.error("No users data received");
          throw new Error("No users data received from Supabase");
        }

        console.log("Successfully fetched users:", users.length);

        // First check if we have a valid session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        console.log("Auth session check:", {
          hasSession: !!session,
          sessionError: sessionError || null,
          userId: session?.user?.id || null,
        });

        // Attempt to fetch schedules directly
        console.log("Fetching schedules...");
        try {
          // First try to get the user's schedule directly
          const { data: userSchedules, error: userSchedulesError } =
            await supabase
              .from("schedules")
              .select("*")
              .eq("user_id", session?.user?.id)
              .maybeSingle();

          console.log("User schedule query result:", {
            hasData: !!userSchedules,
            error: userSchedulesError
              ? {
                  message: userSchedulesError.message,
                  code: userSchedulesError.code,
                  details: userSchedulesError.details,
                  hint: userSchedulesError.hint,
                }
              : null,
          });

          // Then try to get all schedules
          const { data: allSchedules, error: schedulesError } = await supabase
            .from("schedules")
            .select("*");

          console.log("All schedules query result:", {
            hasData: !!allSchedules,
            dataCount: allSchedules?.length || 0,
            error: schedulesError
              ? {
                  message: schedulesError.message,
                  code: schedulesError.code,
                  details: schedulesError.details,
                  hint: schedulesError.hint,
                }
              : null,
          });

          // Map users with schedule data
          const usersWithData = users.map((user) => {
            const schedule = allSchedules?.find((s) => s.user_id === user.id);
            const userCompanies = companies?.filter(
              (company) => user.company_id === company.id || user.has_all_access
            );

            return {
              ...user,
              companies: userCompanies,
              working_shift: schedule?.shift_id || "1",
              off_days: schedule?.off_days || ["saturday", "sunday"],
            };
          });

          console.log("Saving users to IndexedDB...");
          await usersDB.setUsers(usersWithData);

          console.log("Updating users state...");
          updateUsersState(usersWithData, "Database", {
            total: performance.now() - startTime,
            source: "database",
          });
          setLastFetchTime(Date.now());
        } catch (err) {
          console.error("Error in schedules processing:", {
            error: err,
            message: err instanceof Error ? err.message : "Unknown error",
            stack: err instanceof Error ? err.stack : undefined,
            rawError: JSON.stringify(err, null, 2),
          });

          // Continue with default values if there's an error
          const usersWithDefaultData = users.map((user) => ({
            ...user,
            working_shift: "1",
            off_days: ["saturday", "sunday"],
          }));

          console.log("Saving users with default values to IndexedDB...");
          await usersDB.setUsers(usersWithDefaultData);
          updateUsersState(usersWithDefaultData, "Database", {
            total: performance.now() - startTime,
            source: "database",
          });
          setLastFetchTime(Date.now());
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch users")
        );
        setDataSource("Error");
        setUsers([]); // Set empty array on error
        // Show error toast
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to fetch users",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [supabase, toast]
  );

  const fetchAndUpdateCache = async () => {
    try {
      console.log("Starting fetchAndUpdateCache...");
      const startTime = performance.now();

      // First, fetch users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("*");

      if (usersError) {
        console.error("Supabase users query error details:", {
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint,
          code: usersError.code,
        });
        throw usersError;
      }

      if (!users) {
        console.error("No users data received in fetchAndUpdateCache");
        throw new Error("No users data received from Supabase");
      }

      // Then, fetch schedules
      console.log("Fetching schedules...");
      try {
        const { data: schedules, error: schedulesError } = await supabase
          .from("schedules")
          .select("id, user_id, off_days, shift_id");

        console.log("Schedules query result:", {
          hasData: !!schedules,
          dataCount: schedules?.length || 0,
          error: schedulesError
            ? {
                message: schedulesError.message,
                code: schedulesError.code,
                details: schedulesError.details,
                hint: schedulesError.hint,
              }
            : null,
        });

        // If schedules fetch was successful, try to get shifts data separately
        let shiftsData = null;
        if (schedules && schedules.length > 0) {
          console.log("Fetching shifts...");
          const { data: shifts, error: shiftsError } = await supabase
            .from("shifts")
            .select("id, name, start_time, end_time");

          console.log("Shifts query result:", {
            hasData: !!shifts,
            dataCount: shifts?.length || 0,
            error: shiftsError
              ? {
                  message: shiftsError.message,
                  code: shiftsError.code,
                  details: shiftsError.details,
                  hint: shiftsError.hint,
                }
              : null,
          });

          if (!shiftsError && shifts) {
            shiftsData = shifts;
          }
        }

        // Transform the data to include schedule information
        const usersWithData = users.map((user) => {
          const schedule = schedules?.find((s) => s.user_id === user.id);
          const shift =
            schedule?.shift_id && shiftsData
              ? shiftsData.find((s) => s.id === schedule.shift_id)
              : null;

          // Handle company assignments
          let userCompanies: Company[] = [];
          if (user.has_all_access) {
            // If user has all access, include all active companies
            userCompanies =
              companies?.filter((company) => company.status === "active") || [];
          } else if (user.company_id) {
            // If user has a specific company_id, find that company
            const assignedCompany = companies?.find(
              (company) => company.id === user.company_id
            );
            if (assignedCompany) {
              userCompanies = [assignedCompany];
            }
          }

          return {
            ...user,
            companies: userCompanies,
            working_shift: schedule?.shift_id || "1",
            off_days: schedule?.off_days || ["saturday", "sunday"],
          };
        });

        const endTime = performance.now();
        console.log("Saving updated users to IndexedDB...");
        await usersDB.setUsers(usersWithData);

        console.log("Updating users state from cache update...");
        updateUsersState(usersWithData, "Database", {
          total: endTime - startTime,
          source: "database",
        });
        setLastFetchTime(Date.now());
        console.log("Cache update completed successfully");
      } catch (scheduleError) {
        console.error("Error in schedule/shift processing:", {
          error: scheduleError,
          message:
            scheduleError instanceof Error
              ? scheduleError.message
              : "Unknown error",
          stack:
            scheduleError instanceof Error ? scheduleError.stack : undefined,
          rawError: JSON.stringify(scheduleError, null, 2),
        });

        // Continue with default values if there's an error with schedules
        const usersWithDefaultData = users.map((user) => ({
          ...user,
          working_shift: "1",
          off_days: ["saturday", "sunday"],
        }));

        const endTime = performance.now();
        console.log("Saving users with default schedules to IndexedDB...");
        await usersDB.setUsers(usersWithDefaultData);
        updateUsersState(usersWithDefaultData, "Database", {
          total: endTime - startTime,
          source: "database",
        });
        setLastFetchTime(Date.now());
      }
    } catch (error) {
      console.error("Error in fetchAndUpdateCache:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        rawError: JSON.stringify(error, null, 2),
      });
      throw error;
    }
  };

  const clearCache = async () => {
    await usersDB.clearAll();
    await fetchUsers(true);
    toast({
      title: "Cache cleared",
      description: "User list has been refreshed from the server",
    });
  };

  const syncWithServer = async () => {
    try {
      setLoading(true);
      await fetchAndUpdateCache();
      toast({
        title: "Sync complete",
        description: "User list has been synchronized with the server",
      });
    } catch (err) {
      console.error("Error syncing with server:", err);
      toast({
        title: "Sync failed",
        description: "Failed to synchronize with server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
    try {
      console.log("Updating user with data:", data);

      // Remove properties that shouldn't be sent to the server
      const { companies, created_at, ...updateData } = data;

      // Update the user in Supabase
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Supabase update error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Supabase update error: ${error.message}`);
      }

      if (!updatedUser) {
        throw new Error("No data returned from update");
      }

      // Handle company assignments
      let userCompanies: Company[] = [];
      if (updatedUser.has_all_access) {
        // If user has all access, include all active companies
        userCompanies =
          companies?.filter((company) => company.status === "active") || [];
      } else if (updatedUser.company_id) {
        // If user has a specific company_id, find that company
        const assignedCompany = companies?.find(
          (company) => company.id === updatedUser.company_id
        );
        if (assignedCompany) {
          userCompanies = [assignedCompany];
        }
      }

      // Combine user data with companies
      const fullUserData: User = {
        ...updatedUser,
        companies: userCompanies,
      };

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === id ? fullUserData : user))
      );

      // Update cache
      await usersDB.updateUser(fullUserData);

      return fullUserData;
    } catch (error) {
      console.error("Error in updateUser:", error);
      throw error;
    }
  };

  // Handle initial data loading and real-time updates
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([fetchUsers(), fetchCompanies()]);
    };

    loadInitialData();

    // Set up real-time subscription
    const subscription = setupUsersSubscription(
      async (payload: RealtimePayload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (eventType) {
          case "INSERT":
            if (newRecord) {
              setUsers((prev) => [...prev, newRecord]);
              await usersDB.addUser(newRecord);
            }
            break;
          case "UPDATE":
            if (newRecord) {
              setUsers((prev) =>
                prev.map((user) =>
                  user.id === newRecord.id ? newRecord : user
                )
              );
              await usersDB.updateUser(newRecord);
            }
            break;
          case "DELETE":
            if (oldRecord) {
              setUsers((prev) =>
                prev.filter((user) => user.id !== oldRecord.id)
              );
              await usersDB.deleteUser(oldRecord.id);
            }
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUsers]);

  // Handle page visibility changes
  useEffect(() => {
    const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    let lastVisibilityChange = Date.now();

    const handleVisibilityChange = async () => {
      const now = Date.now();

      // Only proceed if the page becomes visible
      if (document.visibilityState === "visible") {
        const timeSinceLastFetch = now - lastFetchTime;
        const timeSinceLastVisibilityChange = now - lastVisibilityChange;

        // Prevent rapid re-fetches and only fetch if significant time has passed
        if (
          timeSinceLastFetch > REFRESH_THRESHOLD &&
          timeSinceLastVisibilityChange > 1000
        ) {
          console.log("Fetching data due to long inactivity:", {
            timeSinceLastFetch:
              Math.round(timeSinceLastFetch / 1000) + " seconds",
            threshold: Math.round(REFRESH_THRESHOLD / 1000) + " seconds",
          });
          await fetchAndUpdateCache();
        }
      }

      lastVisibilityChange = now;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lastFetchTime, fetchAndUpdateCache]);

  const value = {
    users,
    companies,
    loading,
    error,
    dataSource,
    timingInfo,
    refreshUsers: fetchUsers,
    clearCache,
    syncWithServer,
    updateUser,
  };

  return (
    <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
  );
}

export function useUsers() {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
}
