"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Company } from "./types";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import { CompanyDialog } from "./company-dialog";
import { StripeDialog } from "./stripe-dialog";
import { CompanySideDialog } from "./company-side-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "./actions";
import { syncStripeCustomers, syncStripeCustomer } from "./stripe-actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { setupCompaniesSubscription } from "./realtime";
import { TableSkeleton } from "./table-skeleton";
import { cn } from "@/lib/utils";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState<Record<number, boolean>>({});
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
  const { toast } = useToast();

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

  const fetchCompanies = async () => {
    try {
      const response = await getCompanies();
      setCompanies(response.data);
      setDataSource(response.source);
      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleCreateCompany = async (data: Partial<Company>) => {
    try {
      const newCompany = await createCompany(data);
      setCompanies((prev) => [newCompany, ...prev]);
      setDataSource("database");
      setLastFetchTime(new Date());
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
    setDialogOpen(true);
  };

  const handleUpdateStatus = async (company: Company) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [company.id]: true }));
      const updatedCompany = await updateCompany(company.id, {
        status: company.status === "active" ? "inactive" : "active",
      });
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? updatedCompany : c))
      );
      setDataSource("database");
      setLastFetchTime(new Date());
      toast({
        title: "Success",
        description: "Company status updated successfully",
      });
    } catch (error) {
      console.error("Error updating company status:", error);
      toast({
        title: "Error",
        description: "Failed to update company status",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [company.id]: false }));
    }
  };

  const handleSyncAllStripe = async () => {
    try {
      setIsSyncing(true);
      const result = await syncStripeCustomers();
      await fetchCompanies();
      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error) {
      console.error("Error syncing with Stripe:", error);
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

  const handleSyncStripe = async (company: Company) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [company.id]: true }));
      const result = await syncStripeCustomer(company.id);
      const updatedCompany = await getCompanies();
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === company.id
            ? updatedCompany.data.find((uc) => uc.id === company.id) || c
            : c
        )
      );
      setDataSource("database");
      setLastFetchTime(new Date());
      toast({
        title: "Success",
        description: result.message,
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
    }
  };

  const handleStripeSettings = (company: Company) => {
    setSelectedCompany(company);
    setStripeDialogOpen(true);
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
        const error = await response.json();
        throw new Error(error.details || "Failed to connect company to Stripe");
      }

      const updatedCompanies = await getCompanies();
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === company.id
            ? updatedCompanies.data.find((uc) => uc.id === company.id) || c
            : c
        )
      );
      toast({
        title: "Success",
        description: "Company successfully connected to Stripe",
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

  const handleRowClick = (company: Company) => {
    setSelectedCompany(company);
    setSideDialogOpen(true);
  };

  const handleDeleteCompany = async (companyId: number) => {
    try {
      setError(undefined);
      setLoadingRows((prev) => ({ ...prev, [companyId]: true }));
      await deleteCompany(companyId);
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
      setDataSource("database");
      setLastFetchTime(new Date());
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete company";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [companyId]: false }));
    }
  };

  const handleUpdateCompanyInDialog = async (data: Partial<Company>) => {
    if (!selectedCompany) return;
    await handleUpdateCompany(selectedCompany.id, data);
  };

  const handleSideDialogOpenChange = (open: boolean) => {
    setSideDialogOpen(open);
    if (!open) {
      setSelectedCompany(undefined);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
          <p className="text-muted-foreground">
            Manage your companies and their subscriptions
          </p>
          {lastFetchTime && (
            <p className="text-sm text-muted-foreground mt-1">
              Data source: {dataSource === "cache" ? "Cache" : "Database"}
              {" • "}
              Last updated: {lastFetchTime.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Company
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncAllStripe}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing..." : "Sync All"}
          </Button>
          <Button
            variant="outline"
            onClick={fetchCompanies}
            disabled={isInitialLoading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isInitialLoading && "animate-spin")}
            />
            {isInitialLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>
      <div className="px-4 flex-1">
        {isInitialLoading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={companies}
            loadingRows={loadingRows}
            error={error}
            meta={{
              onRowClick: (company) => {
                setSelectedCompany(company);
                setSideDialogOpen(true);
              },
              onEdit: handleEdit,
              onUpdateStatus: handleUpdateStatus,
              onSyncStripe: handleSyncStripe,
              onStripeSettings: (company) => {
                setSelectedCompany(company);
                setStripeDialogOpen(true);
              },
              onConnectStripe: (company) => {
                setSelectedCompany(company);
                setStripeDialogOpen(true);
              },
            }}
          />
        )}
      </div>

      <CompanyDialog
        company={selectedCompany}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={
          selectedCompany ? handleUpdateCompanyInDialog : handleCreateCompany
        }
      />

      {selectedCompany && (
        <>
          <StripeDialog
            company={selectedCompany}
            open={stripeDialogOpen}
            onOpenChange={(open: boolean) => {
              setStripeDialogOpen(open);
              if (!open) setSelectedCompany(undefined);
            }}
          />
          <CompanySideDialog
            company={selectedCompany}
            open={sideDialogOpen}
            onOpenChange={handleSideDialogOpenChange}
            onUpdate={handleUpdateCompany}
            onDelete={handleDeleteCompany}
          />
        </>
      )}
    </div>
  );
}
