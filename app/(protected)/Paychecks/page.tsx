"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  Loader2,
  CalendarIcon,
  Calculator,
} from "lucide-react";
import { PayrollDialog } from "./components/payroll-dialog";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { ErrorBoundary } from "./components/error-boundary";
import { MonthPicker } from "./components/month-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { TransactionsDialog } from "./components/transactions-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { PayrollTransaction, MonthlyPayrollSummary } from "./types";
import {
  generatePayrollAction,
  updateTransactionAction,
} from "./actions/payroll";
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { GeneratePayrollDialog } from "./components/generate-payroll-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Add this type for payment status
type OverallStatus = "paid" | "partially_paid" | "pending" | "unpaid";

// Add this interface for transaction data
interface PayrollTransactionSummary {
  id: number;
  user_id: string;
  amount: number;
  status: "paid" | "pending" | "unpaid" | "charged" | "deducted";
  transaction_date: string;
  transaction_type: string;
}

interface TransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionUpdated?: () => void;
  userId?: string;
}

// Update the PayrollApiResponse interface
interface PayrollApiResponse {
  data: MonthlyPayrollSummary[];
  source: "cache" | "database";
  timing?: {
    total: number;
    database?: number;
    source?: string;
  };
}

export default function PaychecksPage() {
  return (
    <ErrorBoundary>
      <PaychecksContent />
    </ErrorBoundary>
  );
}

function PaychecksContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [summaries, setSummaries] = useState<MonthlyPayrollSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] =
    useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [lastUpdatedUserId, setLastUpdatedUserId] = useState<string | null>(
    null
  );
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const [isAdvancedPayrollDialogOpen, setIsAdvancedPayrollDialogOpen] =
    useState(false);

  // Fetch monthly summaries for the selected month
  const fetchMonthlySummary = useCallback(
    async (skipCache: boolean = false) => {
      try {
        setIsLoading(true);
        const monthKey = format(selectedMonth, "yyyy-MM");

        // Try to get from cache first
        if (!skipCache) {
          const cachedResult = await getClientCache(`payroll:${monthKey}`);
          if (cachedResult && Array.isArray(cachedResult)) {
            console.log("Using cached payroll data");
            setSummaries(cachedResult);
            setDataSource("cache");
            setLastFetchTime(new Date());
            setIsLoading(false);
            return;
          }
        }

        // Fetch from API
        const startTime = performance.now();
        const response = await fetch(
          `/api/payroll/monthly-summary?month=${monthKey}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const fetchTime = Math.round(performance.now() - startTime);

        // Ensure result.data is an array before setting state
        if (!Array.isArray(result.data)) {
          console.error("Invalid data format received:", result);
          setSummaries([]);
        } else {
          console.log(`Summaries loaded from API in ${fetchTime}ms:`, result);
          setSummaries(result.data);
          // Cache the data
          await setClientCache(`payroll:${monthKey}`, result.data, 300);
        }

        setDataSource("database");
        setLastFetchTime(new Date());
      } catch (error) {
        console.error("Error fetching monthly summary:", error);
        toast({
          title: "Error",
          description: "Failed to fetch payroll data",
          variant: "destructive",
        });
        // Ensure summaries is set to an empty array on error
        setSummaries([]);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedMonth, toast]
  );

  // Invalidate cache and fetch fresh data
  const invalidateCache = async () => {
    try {
      setIsInvalidating(true);
      toast({
        title: "Refreshing",
        description: "Fetching fresh data from the database...",
      });

      await fetchMonthlySummary(true);

      toast({
        title: "Success",
        description: "Data refreshed successfully",
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
      setIsInvalidating(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchMonthlySummary();
  }, [fetchMonthlySummary]);

  const handleClearFilters = useCallback(() => {
    fetchMonthlySummary(true);
  }, [fetchMonthlySummary]);

  useEffect(() => {
    const channel = supabase
      .channel("payroll_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payroll_transactions",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log("Payroll transaction changed:", payload);
          handleClearFilters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, handleClearFilters]);

  // Handle month change
  const handleMonthChange = (newMonth: Date) => {
    // Ensure we're always using the first day of the month
    const firstDayOfMonth = startOfMonth(newMonth);
    console.log(`Month changed to: ${format(firstDayOfMonth, "yyyy-MM-dd")}`);
    setSelectedMonth(firstDayOfMonth);
  };

  // Handle view transactions
  const handleViewTransactions = (userId: string) => {
    setSelectedUserId(userId);
    setIsTransactionsDialogOpen(true);
  };

  // Handle dialog close
  const handleTransactionsDialogClose = (open: boolean) => {
    setIsTransactionsDialogOpen(open);
    if (!open) {
      setTimeout(() => {
        setSelectedUserId(null);
      }, 300);
    }
  };

  // Handle payroll dialog success
  const handlePayrollDialogSuccess = () => {
    setIsPayrollDialogOpen(false);
    fetchMonthlySummary(true);
    toast({
      title: "Success",
      description: "Transaction created successfully",
    });
  };

  // Handle transaction update
  const handleTransactionUpdated = () => {
    fetchMonthlySummary(true);
  };

  // Generate payroll
  const handleGeneratePayroll = async () => {
    try {
      const result = await generatePayrollAction();
      if (result.success) {
        toast({
          title: "Success",
          description: "Payroll generated successfully",
        });
        fetchMonthlySummary(true);
      } else {
        throw new Error(result.error || "Failed to generate payroll");
      }
    } catch (error) {
      console.error("Error generating payroll:", error);
      toast({
        title: "Error",
        description: "Failed to generate payroll",
        variant: "destructive",
      });
    }
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    if (!Array.isArray(summaries) || summaries.length === 0) {
      return { total: 0, paid: 0, pending: 0 };
    }

    return summaries.reduce(
      (acc, summary) => {
        if (!summary) return acc;
        acc.total += summary.total_amount || 0;
        acc.paid += summary.paid_amount || 0;
        acc.pending += summary.pending_amount || 0;
        return acc;
      },
      { total: 0, paid: 0, pending: 0 }
    );
  };

  const summary = calculateSummary();

  return (
    <div className=" py-4 px-4">
      {/* Header Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Paychecks</CardTitle>
              <CardDescription>
                Manage employee payroll transactions
              </CardDescription>
              <div className="text-xs text-muted-foreground mt-1">
                Data source: {dataSource === "cache" ? "Cache" : "Database"}
                {lastFetchTime && (
                  <span className="ml-2">
                    • Last updated: {lastFetchTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <MonthPicker
                selected={selectedMonth}
                onMonthChange={handleMonthChange}
              />
              <Button
                variant="outline"
                onClick={invalidateCache}
                disabled={isInvalidating || isLoading}
                className="min-w-[100px]"
              >
                {isInvalidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAdvancedPayrollDialogOpen(true)}
                disabled={isLoading}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Generate Payroll
              </Button>
              <Button onClick={() => setIsPayrollDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payroll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.total.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              For {format(selectedMonth, "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${summary.paid.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((summary.paid / summary.total) * 100 || 0).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              ${summary.pending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((summary.pending / summary.total) * 100 || 0).toFixed(1)}% of
              total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={summaries}
        isLoading={isLoading || isInvalidating}
        onViewTransactions={handleViewTransactions}
        lastUpdatedUserId={lastUpdatedUserId}
        emptyMessage={`No payroll data found for ${format(selectedMonth, "MMMM yyyy")}`}
      />

      <PayrollDialog
        open={isPayrollDialogOpen}
        onOpenChange={setIsPayrollDialogOpen}
        onSuccess={handlePayrollDialogSuccess}
      />

      {selectedUserId && (
        <TransactionsDialog
          open={isTransactionsDialogOpen}
          onOpenChange={handleTransactionsDialogClose}
          userId={selectedUserId}
          onTransactionUpdated={handleTransactionUpdated}
        />
      )}

      <GeneratePayrollDialog
        open={isAdvancedPayrollDialogOpen}
        onOpenChange={setIsAdvancedPayrollDialogOpen}
        onSuccess={handlePayrollDialogSuccess}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex flex-col space-y-1.5">
        <h3 className="font-medium">{title}</h3>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Add mock data for testing
const mockPerformanceData = [
  {
    user_id: "1",
    month: "2024-02",
    attendance_rate: 98,
    productivity_score: 92,
    quality_score: 95,
    overall_score: 95,
    bonus_amount: 250,
    user: {
      first_name: "John",
      last_name: "Ganiev",
    },
  },
  // Add more mock data...
];

const mockShiftData = [
  {
    id: "1",
    user: {
      first_name: "John",
      last_name: "Ganiev",
    },
    shift: {
      id: "1",
      name: "Morning Shift",
      start_time: "09:00:00",
      end_time: "17:00:00",
      hours: 8,
      description: "Regular day shift",
    },
    day_of_week: 1, // Monday
    is_weekend_rotation: false,
  },
  // Add more mock data...
];

// In PerformanceMetrics component:
const fetchMetrics = async () => {
  // For testing, return mock data
  return mockPerformanceData;
};

// In ShiftSchedule component:
const fetchSchedule = async () => {
  // For testing, return mock data
  return mockShiftData;
};

// Add this function to calculate overall status
const getOverallStatus = (summary: MonthlyPayrollSummary): OverallStatus => {
  if (summary.total_amount <= 0) return "paid";
  if (summary.paid_amount >= summary.total_amount) return "paid";
  if (summary.paid_amount > 0) return "partially_paid";
  if (summary.pending_amount > 0) return "pending";
  return "unpaid";
};

// Add this function to get status badge class
const getStatusBadgeClass = (status: OverallStatus) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "partially_paid":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "unpaid":
      return "bg-red-100 text-red-800";
  }
};
