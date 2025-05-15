"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { toast } from "sonner";
import { Company, RealtimePayload } from "../types";
import { useRouter } from "next/navigation";
import { clearCompanyCache } from "../actions";
import {
  updateCompanyAction,
  getCompaniesAction,
  clearCompanyCachesAction,
} from "../server-actions";
import { syncStripeCustomer } from "../stripe-actions";
import { getRealTimeClient } from "@/utils/supabase/client";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { prefetchCompanyUsers } from "./company-users";

interface CompaniesContextType {
  companies: Company[];
  error: Error | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncWithServer: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateCompanyOptimistically: (id: number, updates: Partial<Company>) => void;
  processingCompanies: Record<number, boolean>;
  setProcessingCompany: (id: number, processing: boolean) => void;
  showImportDialog: boolean;
  setShowImportDialog: (show: boolean) => void;
  handleRowClick: (companyId: number) => void;
  refreshCompanies: (skipCache?: boolean) => Promise<void>;
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  getCompanyById: (id: number) => Company | null;
  syncStripeCompany: (company: Company) => Promise<void>;
  handleUpdateCompany: (id: number, data: Partial<Company>) => Promise<void>;
  handleCreateCompany: (data: Partial<Company>) => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextType | undefined>(
  undefined
);

// Constants for throttling
const REFRESH_THROTTLE = 2000; // Min time between refreshes (2 seconds)
const REALTIME_DEBOUNCE = 500; // Debounce realtime updates
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // Auto refresh every 5 min

interface CompaniesClientProviderProps {
  children: React.ReactNode;
  initialCompanies: Company[];
}

function getChangedFields(oldRecord: any, newRecord: any): string[] {
  if (!oldRecord || !newRecord) return [];

  const changedFields: string[] = [];
  const keyMappings: Record<string, string> = {
    name: "Name",
    contact_email: "Contact Email",
    contact_phone: "Contact Phone",
    contact_first_name: "First Name",
    contact_last_name: "Last Name",
    status: "Status",
    stripe_customer_id: "Stripe Customer",
    subscription_status: "Subscription Status",
  };

  // Check common fields that we care about showing in notifications
  for (const key of Object.keys(keyMappings)) {
    if (
      oldRecord[key] !== newRecord[key] &&
      oldRecord[key] !== undefined &&
      newRecord[key] !== undefined
    ) {
      changedFields.push(keyMappings[key]);
    }
  }

  return changedFields;
}

export function CompaniesClientProvider({
  children,
  initialCompanies,
}: CompaniesClientProviderProps) {
  // Ensure initialCompanies is an array
  const safeInitialCompanies = Array.isArray(initialCompanies)
    ? initialCompanies
    : [];

  const [companies, setCompanies] = useState<Company[]>(safeInitialCompanies);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingCompanies, setProcessingCompanies] = useState<
    Record<number, boolean>
  >({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const router = useRouter();
  const supabase = getRealTimeClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // Only refresh after 5 minutes of inactivity
  const [deletedCompanyIds, setDeletedCompanyIds] = useState<Set<number>>(
    new Set()
  );
  const [pendingRealtimeUpdates, setPendingRealtimeUpdates] = useState<
    RealtimePayload[]
  >([]);
  const [realtimeDebounceTimer, setRealtimeDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [autoRefreshTimer, setAutoRefreshTimer] =
    useState<NodeJS.Timeout | null>(null);

  // Memoize frequently accessed values to prevent unnecessary re-renders
  const companyMap = useMemo(() => {
    const map = new Map<number, Company>();
    // Ensure companies is an array before using forEach
    if (Array.isArray(companies)) {
      companies.forEach((company) => {
        if (company && typeof company.id === "number") {
          map.set(company.id, company);
        }
      });
    }
    return map;
  }, [companies]);

  const setProcessingCompany = useCallback(
    (id: number, processing: boolean) => {
      setProcessingCompanies((prev) => ({ ...prev, [id]: processing }));
    },
    []
  );

  const updateCompanyOptimistically = useCallback(
    (id: number, updates: Partial<Company>) => {
      console.log(`Optimistically updating company ${id} with:`, updates);

      setCompanies((prevCompanies) => {
        // Ensure prevCompanies is an array
        if (!Array.isArray(prevCompanies)) {
          console.warn(
            "Previous companies is not an array, initializing to empty array"
          );
          return []; // Return empty array as a fallback
        }

        // Find the company to update
        const companyIndex = prevCompanies.findIndex(
          (company) => company?.id === id
        );

        if (companyIndex === -1) {
          console.warn(`Company with ID ${id} not found in local state`);
          return prevCompanies;
        }

        // Get the original company
        const oldCompany = prevCompanies[companyIndex];

        // Create a deep copy of the original company
        const companyCopy = JSON.parse(JSON.stringify(oldCompany));

        // Create a deep copy of the updates to avoid reference issues
        const updatesCopy = JSON.parse(JSON.stringify(updates));

        // Create updated company with merged data
        const updatedCompany = {
          ...companyCopy,
          ...updatesCopy,
        };

        // Set timestamp
        updatedCompany.updated_at =
          updatesCopy.updated_at || new Date().toISOString();

        // Create a new array with the updated company
        const updatedCompanies = [...prevCompanies];
        updatedCompanies[companyIndex] = updatedCompany;

        return updatedCompanies;
      });
    },
    []
  );

  const syncWithServer = async () => {
    try {
      setIsSyncing(true);
      setIsLoading(true);

      // Force revalidation to get fresh data from the server
      router.refresh();

      toast.success("Sync complete");
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      // Clear server-side cache only
      await clearCompanyCachesAction();

      // Force revalidation to get fresh data
      router.refresh();

      toast.success("Cache cleared");
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast.error("Failed to clear the cache. Please try again.");
    }
  };

  // Throttled refresh to prevent too many refreshes in quick succession
  const refreshCompanies = useCallback(
    async (skipCache?: boolean) => {
      const now = Date.now();

      // Skip if we refreshed too recently, unless forced
      if (!skipCache && now - lastRefreshTime < REFRESH_THROTTLE) {
        console.log("Skipping refresh, too soon since last refresh");
        return;
      }

      try {
        setLastRefreshTime(now);
        setIsLoading(true);
        const result = await getCompaniesAction();

        // Ensure data is an array before setting state
        const companiesData = Array.isArray(result.data) ? result.data : [];
        setCompanies(companiesData);

        setLastUpdateTime(now);
        console.log(
          `Refreshed companies in ${Date.now() - now}ms, source: ${result.source}`
        );
      } catch (error) {
        console.error("Error refreshing companies:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        toast.error("Failed to refresh companies");
      } finally {
        setIsLoading(false);
      }
    },
    [lastRefreshTime]
  );

  const getCompanyById = useCallback(
    (id: number): Company | null => {
      // Use memoized map for O(1) lookup instead of find (O(n))
      return companyMap.get(id) || null;
    },
    [companyMap]
  );

  const handleRowClick = useCallback(
    (companyId: number) => {
      console.log(`Row clicked for company ID: ${companyId}`);

      // Try to find the company in our local state
      const company = getCompanyById(companyId);

      if (company) {
        console.log(`Company found in local state: ${company.name}`);
        setSelectedCompany(company);

        // Prefetch users data for this company when clicked
        if (company.id) {
          try {
            prefetchCompanyUsers(company.id);
          } catch (error) {
            console.error(`Error prefetching users: ${error}`);
          }
        }
      } else {
        console.error(`Company with ID ${companyId} not found in local state`);
        // If the company isn't in local state, try to fetch it
        fetchCompanyById(companyId);
      }
    },
    [getCompanyById]
  );

  // Helper function to fetch a company by ID if not in local state
  const fetchCompanyById = async (companyId: number) => {
    console.log(`Fetching company ${companyId} from server...`);
    try {
      setIsLoading(true);
      const response = await fetch(`/api/companies/${companyId}`);
      const data = await response.json();

      if (data.company) {
        console.log(`Company ${companyId} fetched:`, data.company);
        setSelectedCompany(data.company);
      } else {
        console.error(`Company ${companyId} not found in API response`);
        toast.error(`Couldn't find company with ID ${companyId}`);
      }
    } catch (error) {
      console.error(`Error fetching company ${companyId}:`, error);
      toast.error("Error loading company details");
    } finally {
      setIsLoading(false);
    }
  };

  const syncStripeCompany = async (company: Company) => {
    try {
      setProcessingCompany(company.id, true);
      await syncStripeCustomer(company.id);
      await refreshCompanies();
      toast.success(`Synced ${company.name} with Stripe`);
    } catch (error) {
      console.error("Error syncing with Stripe:", error);
      toast.error("Failed to sync with Stripe");
    } finally {
      setProcessingCompany(company.id, false);
    }
  };

  const handleUpdateCompany = async (id: number, data: Partial<Company>) => {
    try {
      // Update optimistically
      updateCompanyOptimistically(id, data);

      // Perform actual update
      await updateCompanyAction(id, data);

      // Update selected company if it's the one being edited
      if (selectedCompany?.id === id) {
        setSelectedCompany((prev) => (prev ? { ...prev, ...data } : null));
      }

      // No need to refresh immediately - the realtime subscription will handle it
      toast.success("Company updated successfully");
    } catch (error) {
      console.error("Error updating company:", error);
      // Refresh to ensure we have the correct data
      refreshCompanies(true);
      toast.error("Failed to update company");
    }
  };

  const handleCreateCompany = async (data: Partial<Company>) => {
    try {
      await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      await refreshCompanies();
      toast.success("Company created successfully");
    } catch (error) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company");
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      channel = supabase
        .channel("companies_updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "companies",
          },
          async (payload) => {
            console.log("Received UPDATE payload:", payload);
            const eventType = payload.eventType;
            const newRecord = payload.new as Company;
            const oldRecord = payload.old as Company;

            // Process updates
            const changedFields = getChangedFields(oldRecord, newRecord);

            if (changedFields.length > 0) {
              toast.info(
                `Company ${newRecord.name} updated: ${changedFields.join(", ")}`
              );
            }

            // Update local state
            await refreshCompanies();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "companies",
          },
          async (payload) => {
            console.log("Received INSERT payload:", payload);
            const newRecord = payload.new as Company;

            toast.info(`New company added: ${newRecord.name}`);

            // Update local state
            await refreshCompanies();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "companies",
          },
          async (payload) => {
            console.log("Received DELETE payload:", payload);
            const oldRecord = payload.old as Company;

            toast.info(`Company deleted: ${oldRecord.name}`);

            // Update local state
            await refreshCompanies();
          }
        )
        .subscribe((status, err) => {
          console.log("Realtime subscription status:", status);
          if (err) {
            console.error("Realtime subscription error:", err);
          } else {
            console.log("Successfully subscribed to realtime updates");
          }
        });
    };

    setupRealtimeSubscription();

    // Handle visibility change to refresh data when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime > REFRESH_THRESHOLD) {
          console.log("Page visible again after inactivity, refreshing data");
          refreshCompanies();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshCompanies, supabase, lastUpdateTime]);

  // When page loads, prefetch data for the first few companies
  useEffect(() => {
    const prefetchTopCompanies = async () => {
      if (!Array.isArray(companies) || companies.length === 0) return;

      // Prefetch users for the first 3 companies (most likely to be viewed)
      for (const company of companies.slice(0, 3)) {
        if (!company || typeof company.id !== "number") continue;

        try {
          // Delay prefetching to let the page finish loading first
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await prefetchCompanyUsers(company.id);
        } catch (error) {
          console.error(
            `Error prefetching users for company ${company.id}:`,
            error
          );
        }
      }
    };

    prefetchTopCompanies();
  }, [companies]);

  // Add a useEffect to properly initialize companies from props or refresh data if needed
  useEffect(() => {
    // Log the initial data received from the server
    console.log(
      "CompaniesClientProvider: Initializing with data:",
      initialCompanies
    );

    // Ensure companies state is updated with initial data if it has valid entries
    if (Array.isArray(initialCompanies) && initialCompanies.length > 0) {
      setCompanies(initialCompanies);
      setLastUpdateTime(Date.now());
      console.log(
        `CompaniesClientProvider: Initialized with ${initialCompanies.length} companies`
      );
    }
    // If companies is empty but we previously had companies, keep the old state
    else if (
      Array.isArray(initialCompanies) &&
      initialCompanies.length === 0 &&
      companies.length > 0
    ) {
      console.log(
        "CompaniesClientProvider: Received empty initialCompanies but keeping existing state"
      );
    }
    // If both are empty, try to fetch
    else if (
      Array.isArray(initialCompanies) &&
      initialCompanies.length === 0 &&
      companies.length === 0
    ) {
      console.log(
        "CompaniesClientProvider: No companies data, will attempt to fetch"
      );
      // Small delay before fetching to let UI render first
      const timer = setTimeout(() => {
        refreshCompanies(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [initialCompanies]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      companies,
      error,
      isLoading,
      isSyncing,
      syncWithServer,
      clearCache,
      updateCompanyOptimistically,
      processingCompanies,
      setProcessingCompany,
      showImportDialog,
      setShowImportDialog,
      handleRowClick,
      refreshCompanies,
      selectedCompany,
      setSelectedCompany,
      getCompanyById,
      syncStripeCompany,
      handleUpdateCompany,
      handleCreateCompany,
    }),
    [
      companies,
      error,
      isLoading,
      isSyncing,
      processingCompanies,
      showImportDialog,
      selectedCompany,
      handleRowClick,
      refreshCompanies,
      getCompanyById,
      updateCompanyOptimistically,
      setProcessingCompany,
      handleUpdateCompany,
      handleCreateCompany,
    ]
  );

  return (
    <CompaniesContext.Provider value={contextValue}>
      {children}
    </CompaniesContext.Provider>
  );
}

export function useCompanies() {
  const context = useContext(CompaniesContext);
  if (context === undefined) {
    throw new Error(
      "useCompanies must be used within a CompaniesClientProvider"
    );
  }
  return context;
}
