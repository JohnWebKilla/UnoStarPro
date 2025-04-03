"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { setupUsersSubscription, RealtimePayload } from "../../realtime";
import { usersDB } from "../../lib/indexdb";
import { User } from "../../types";
import { getUsers, clearUserCaches } from "../../lib/actions/optimized-actions";
import { useRouter } from "next/navigation";

interface Company {
  id: number;
  name: string;
}

interface TimingInfo {
  total: number;
  database?: number;
  source: string;
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
      if (cachedCompanies.length > 0) {
        setCompanies(cachedCompanies);
        return;
      }

      // If not in cache, fetch from API
      const { data, error } = await supabase.from("companies").select("*");
      if (error) throw error;

      // Cache the results
      await usersDB.setCompanies(data);
      setCompanies(data);
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
        const { data, error } = await supabase.from("users").select("*");
        if (error) throw error;

        const endTime = performance.now();
        await usersDB.setUsers(data);

        updateUsersState(data, "Database", {
          total: endTime - startTime,
          source: "database",
        });
        setLastFetchTime(Date.now());
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch users")
        );
        setDataSource("Error");
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const fetchAndUpdateCache = async () => {
    const startTime = performance.now();
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;

    const endTime = performance.now();
    await usersDB.setUsers(data);

    updateUsersState(data, "Database", {
      total: endTime - startTime,
      source: "database",
    });
    setLastFetchTime(Date.now());
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

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTime;

        // Only fetch if it's been more than 5 minutes since the last fetch
        if (timeSinceLastFetch > REFRESH_THRESHOLD) {
          await fetchAndUpdateCache();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lastFetchTime]);

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
