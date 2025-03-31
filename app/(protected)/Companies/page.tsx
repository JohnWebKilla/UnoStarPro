"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Company } from "./types";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  Database,
} from "lucide-react";
import { CompanyDialog } from "./company-dialog";
import { StripeDialog } from "./stripe-dialog";
import { CompanySideDialog } from "./company-side-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getCompanies,
  createCompany,
  updateCompany,
  clearCompanyCache,
} from "./actions";
import { syncStripeCustomers, syncStripeCustomer } from "./stripe-actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { setupCompaniesSubscription } from "./realtime";
import { TableSkeleton } from "./table-skeleton";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./summary-cards";
import { syncStripeCustomer as getStripeSubscriptionDetails } from "./stripe-actions";
import { subscriptionDetailsCache, CACHE_TTL } from "./cache";
import { DeactivationDialog } from "./components/deactivation-dialog";
import { Badge } from "@/components/ui/badge";

interface ToggleStatusOptions {
  cancelSubscription?: boolean;
  cancellationType?: "now" | "end_period";
  issueRefund?: boolean;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState<Record<number, boolean>>({});
  const [syncingRowIds, setSyncingRowIds] = useState<Record<number, number>>(
    {}
  );
  const [error, setError] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [sideDialogOpen, setSideDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [editDialogMode, setEditDialogMode] = useState(false);
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [companyToDeactivate, setCompanyToDeactivate] = useState<
    Company | undefined
  >();
  const { toast } = useToast();
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    source?: string;
  } | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel;

    const initialize = async () => {
      try {
        console.log("Initializing Companies page...");
        await fetchCompanies();

        channel = setupCompaniesSubscription(async (payload) => {
          // Handle individual row updates
          if (payload.eventType === "UPDATE") {
            setCompanies((prev) =>
              prev.map((company) =>
                company.id === payload.new.id
                  ? { ...company, ...payload.new }
                  : company
              )
            );
            setDataSource("database");
            setLastFetchTime(new Date());
          } else if (payload.eventType === "INSERT") {
            setCompanies((prev) => [payload.new, ...prev]);
            setDataSource("database");
            setLastFetchTime(new Date());
          } else if (payload.eventType === "DELETE") {
            setCompanies((prev) =>
              prev.filter((company) => company.id !== payload.old.id)
            );
            setDataSource("database");
            setLastFetchTime(new Date());
          }
        });

        console.log("Real-time subscription initialized successfully");
      } catch (error) {
        console.error("Error initializing Companies page:", error);
        toast({
          title: "Error",
          description: "Failed to initialize real-time updates",
          variant: "destructive",
        });
      }
    };

    initialize();

    return () => {
      if (channel) {
        console.log("Cleaning up real-time subscription");
        const supabase = createClient();
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, []);

  const fetchCompanies = useCallback(async (skipCache = false) => {
    try {
      console.log("Fetching companies, skipCache:", skipCache);
      // Don't show any data source initially when loading
      setDataSource("database");
      setTimingInfo(null);

      const result = await getCompanies(skipCache);
      setCompanies(result.data);
      setDataSource(result.source);
      setLastFetchTime(new Date());
      setTimingInfo(result.timing);
      console.log(
        `Loaded ${result.data.length} companies from ${result.source} in ${result.timing.total.toFixed(
          0
        )}ms`
      );
    } catch (error) {
      console.error("Error fetching companies:", error);
      setError("Failed to load companies");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const handleCreateCompany = async (data: Partial<Company>) => {
    try {
      await createCompany(data);
      await fetchCompanies(true);
      setDialogOpen(false);
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    } catch (error) {
      console.error("Error creating company:", error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCompany = async (
    companyId: number,
    data: Partial<Company>
  ) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [companyId]: true }));
      const updatedCompany = await updateCompany(companyId, data);
      setCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId ? updatedCompany : company
        )
      );
      setDataSource("database");
      setLastFetchTime(new Date());
      toast({
        title: "Success",
        description: "Company updated successfully",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description: "Failed to update company",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [companyId]: false }));
    }
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setSideDialogOpen(true);
    setEditDialogMode(true);
  };

  const handleUpdateStatus = async (company: Company) => {
    if (company.status === "active") {
      setCompanyToDeactivate(company);
      setShowDeactivationDialog(true);
    } else {
      await performStatusUpdate(company.id, "active" as "active" | "inactive");
    }
  };

  const performStatusUpdate = async (
    companyId: number,
    status: "active" | "inactive",
    options?: ToggleStatusOptions
  ) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [companyId]: true }));

      if (options?.cancelSubscription) {
        const response = await fetch(
          `/api/companies/${companyId}/subscription/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              atPeriodEnd: options.cancellationType === "end_period",
              issueRefund: options.issueRefund,
              updateStatus: true,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || "Failed to cancel subscription");
        }

        await fetchCompanies(true);
      } else {
        const updatedCompany = await updateCompany(companyId, { status });
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? updatedCompany : c))
        );
      }

      setDataSource("database");
      setLastFetchTime(new Date());
      toast({
        title: "Success",
        description: `Company ${status === "active" ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      console.error("Error updating company status:", error);
      toast({
        title: "Error",
        description: "Failed to update company status",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [companyId]: false }));
    }
  };

  const handleDeactivationConfirm = async (options?: ToggleStatusOptions) => {
    if (!companyToDeactivate) return;
    await performStatusUpdate(companyToDeactivate.id, "inactive", options);
    setShowDeactivationDialog(false);
    setCompanyToDeactivate(undefined);
  };

  const handleDeactivationCancel = () => {
    setShowDeactivationDialog(false);
    setCompanyToDeactivate(undefined);
  };

  const handleSyncAllStripe = async () => {
    try {
      setIsSyncing(true);
      await syncStripeCustomers();
      await fetchCompanies(true);
      toast({
        title: "Success",
        description: "All companies synced with Stripe successfully",
      });
    } catch (error) {
      console.error("Error syncing companies with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to sync with Stripe",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCompanyCache = async () => {
    try {
      setIsSyncing(true);
      const result = await clearCompanyCache();
      if (result.success) {
        toast({
          title: "Success",
          description: "Company cache cleared successfully",
        });
        await fetchCompanies(true);
      } else {
        throw new Error(result.error || "Failed to clear cache");
      }
    } catch (error) {
      console.error("Error clearing company cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear company cache",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncStripe = async (company: Company) => {
    try {
      // Check if this company was synced recently (within 10 seconds)
      const lastSyncTime = syncingRowIds[company.id];
      const currentTime = Date.now();

      if (lastSyncTime && currentTime - lastSyncTime < 10000) {
        console.log(
          `Skipping sync for ${company.name} - already synced recently`
        );
        toast({
          title: "Info",
          description:
            "This company was synced recently. Please wait a moment before syncing again.",
        });
        return;
      }

      // Record sync time and set loading state
      setSyncingRowIds((prev) => ({ ...prev, [company.id]: currentTime }));
      setLoadingRows((prev) => ({ ...prev, [company.id]: true }));

      const result = await syncStripeCustomer(company.id);
      await fetchCompanies(true);

      toast({
        title: "Success",
        description: "Company synced with Stripe successfully",
      });
    } catch (error) {
      console.error("Error syncing company with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to sync company with Stripe",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [company.id]: false }));

      // After 10 seconds, remove the company from the syncing list
      setTimeout(() => {
        setSyncingRowIds((prev) => {
          const newState = { ...prev };
          delete newState[company.id];
          return newState;
        });
      }, 10000);
    }
  };

  const handleStripeSettings = (company: Company) => {
    setSelectedCompany(company);
    setStripeDialogOpen(true);
  };

  const handleUpdateCompanyInDialog = async (data: Partial<Company>) => {
    if (!selectedCompany) return;
    await handleUpdateCompany(selectedCompany.id, data);
    setDialogOpen(false);
    setStripeDialogOpen(false);
  };

  const handleRowClick = (company: Company) => {
    setSelectedCompany(company);
    setSideDialogOpen(true);
    setEditDialogMode(false);
  };

  const handleSideDialogOpenChange = (open: boolean) => {
    setSideDialogOpen(open);
    if (!open) {
      setEditDialogMode(false);
    }
  };

  const handleConnectStripe = async (company: Company) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [company.id]: true }));
      const response = await fetch(
        `/api/companies/${company.id}/connect-stripe`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to connect to Stripe");
      }

      await fetchCompanies(true);
      toast({
        title: "Success",
        description: "Company connected to Stripe successfully",
      });
    } catch (error) {
      console.error("Error connecting company to Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect company to Stripe",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [company.id]: false }));
    }
  };

  const renderDataSourceIndicator = () => {
    // If we're still loading or don't have timing info, don't show anything
    if (isInitialLoading || !timingInfo) {
      return null;
    }

    const getDataSourceColor = () => {
      if (dataSource === "database")
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";

      if (timingInfo?.source === "server" && dataSource === "cache")
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";

      if (timingInfo?.source === "client-cache")
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";

      if (timingInfo?.source === "local-storage")
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";

      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    };

    const getDataSourceName = () => {
      if (dataSource === "database") return "Database";

      if (timingInfo?.source === "server" && dataSource === "cache")
        return "Redis Cache";

      if (timingInfo?.source === "client-cache") return "Client Cache (API)";

      if (timingInfo?.source === "local-storage") return "Client Cache (Local)";

      return dataSource;
    };

    return (
      <Badge
        variant="outline"
        className={`${getDataSourceColor()} flex items-center gap-1 ml-2`}
      >
        <Database className="h-3 w-3" />
        {getDataSourceName()}
        {lastFetchTime && timingInfo && (
          <span className="ml-1 text-xs">
            ({(timingInfo.total / 1000).toFixed(2)}s)
          </span>
        )}
      </Badge>
    );
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Companies</h1>
          <div className="flex items-center">
            <p className="text-muted-foreground">
              Manage your companies and their Stripe integrations
            </p>
            {isInitialLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm ml-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading data...
              </div>
            ) : (
              renderDataSourceIndicator()
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncAllStripe}
            disabled={isSyncing}
            className="h-9"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Stripe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCompanyCache}
            disabled={isSyncing}
            className="h-9 relative z-0"
          >
            Clear Cache
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="h-9">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {isInitialLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SummaryCards companies={companies} />

          <DataTable
            columns={columns}
            data={companies}
            loadingRows={loadingRows}
            meta={{
              onEdit: handleEdit,
              onUpdateStatus: handleUpdateStatus,
              onSyncStripe: handleSyncStripe,
              onStripeSettings: handleStripeSettings,
              onConnectStripe: handleConnectStripe,
              onRowClick: handleRowClick,
            }}
            error={error}
          />
        </>
      )}

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={selectedCompany}
        onSubmit={
          selectedCompany ? handleUpdateCompanyInDialog : handleCreateCompany
        }
      />

      <StripeDialog
        open={stripeDialogOpen}
        onOpenChange={setStripeDialogOpen}
        company={selectedCompany}
        onSubmit={handleUpdateCompanyInDialog}
      />

      {selectedCompany && (
        <CompanySideDialog
          open={sideDialogOpen}
          onOpenChange={handleSideDialogOpenChange}
          company={selectedCompany}
          onUpdate={handleUpdateCompany}
          initialEditMode={editDialogMode}
        />
      )}

      {companyToDeactivate && (
        <DeactivationDialog
          company={companyToDeactivate}
          onToggleStatus={handleDeactivationConfirm}
          onCancel={handleDeactivationCancel}
          open={showDeactivationDialog}
        />
      )}
    </div>
  );
}
