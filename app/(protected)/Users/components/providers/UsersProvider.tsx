"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../../lib/types/types";
import { getUsers, clearUserCaches } from "../../lib/actions/optimized-actions";
import { useToast } from "@/components/ui/use-toast";

interface Company {
  id: number;
  name: string;
}

interface UsersContextType {
  users: User[];
  loading: boolean;
  companies: Company[];
  refreshUsers: (skipCache?: boolean) => Promise<void>;
  dataSource: string;
  timingInfo?: {
    total: number;
    database?: number;
    source: string;
  };
  clearCache: () => Promise<void>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>("Loading...");
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source: string;
  }>();
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("Failed to fetch companies");
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async (skipCache: boolean = false) => {
    setLoading(true);
    try {
      const response = await getUsers(skipCache);
      setUsers(response.data);
      setDataSource(
        response.source === "cache"
          ? `${
              response.timing.source === "local-storage"
                ? "Client Cache (Local)"
                : "Client Cache (API)"
            }`
          : "Database"
      );
      setTimingInfo(response.timing);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      await clearUserCaches();
      await fetchUsers(true); // Refresh from database after clearing cache
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  return (
    <UsersContext.Provider
      value={{
        users,
        companies,
        loading,
        refreshUsers: fetchUsers,
        dataSource,
        timingInfo,
        clearCache,
      }}
    >
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
}
