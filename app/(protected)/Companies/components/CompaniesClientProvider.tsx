"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
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
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // Only refresh after 5 minutes of inactivity
  const [deletedCompanyIds, setDeletedCompanyIds] = useState<Set<number>>(
    new Set()
  );

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
        // Find the company to update
        const companyIndex = prevCompanies.findIndex(
          (company) => company.id === id
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

  const refreshCompanies = async (skipCache?: boolean) => {
    try {
      setIsLoading(true);
      const result = await getCompaniesAction();
      setCompanies(result.data);
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error("Error refreshing companies:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      toast.error("Failed to refresh companies");
    } finally {
      setIsLoading(false);
    }
  };

  const getCompanyById = useCallback(
    (id: number): Company | null => {
      return companies.find((company) => company.id === id) || null;
    },
    [companies]
  );

  const handleRowClick = useCallback(
    (companyId: number) => {
      const company = getCompanyById(companyId);
      if (company) {
        setSelectedCompany(company);
      }
    },
    [getCompanyById]
  );

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

      // Refresh the data
      await refreshCompanies();

      toast.success("Company updated successfully");
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error("Failed to update company");

      // Revert optimistic update by refreshing
      await refreshCompanies();
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

  const value = {
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
  };

  return (
    <CompaniesContext.Provider value={value}>
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
