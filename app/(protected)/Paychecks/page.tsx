"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import {
  Plus,
  PlusCircle,
  RefreshCw,
  Loader2,
  CalendarIcon,
  Calculator,
  Database,
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
import {
  getMonthlyPayrollSummaries,
  clearPayrollCaches,
} from "./actions/client-actions";
import { PaychecksHeader } from "./components/paychecks-header";

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
      <div>
        <PaychecksContent />
      </div>
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
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);

  // Fetch monthly summaries for the selected month
  const fetchMonthlySummary = useCallback(
    async (skipCache: boolean = false) => {
      try {
        setIsLoading(true);

        // Use our new client action with multi-layer caching
        const result = await getMonthlyPayrollSummaries(
          selectedMonth,
          skipCache
        );

        // Ensure result data is valid and is an array
        if (!result || !result.data) {
          console.error(
            "Invalid response from getMonthlyPayrollSummaries:",
            result
          );
          setSummaries([]);
          toast({
            title: "Error",
            description: "Received invalid payroll data",
            variant: "destructive",
          });
          return;
        }

        if (!Array.isArray(result.data)) {
          console.error("Expected array but got:", result.data);
          setSummaries([]);
          toast({
            title: "Error",
            description: "Received invalid payroll data format",
            variant: "destructive",
          });
          return;
        }

        // Update state with the response data
        setSummaries(result.data);
        setDataSource(result.source);
        setTimingInfo(result.timing);
        setLastFetchTime(new Date());

        console.log(
          `Loaded ${result.data.length} payroll summaries from ${result.source} in ${result.timing.total.toFixed(0)}ms`
        );
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

  // Update the invalidateCache function
  const invalidateCache = async () => {
    try {
      setIsInvalidating(true);
      toast({
        title: "Refreshing",
        description: "Fetching fresh data from the database...",
      });

      // Clear the cache for the current month
      const monthKey = format(selectedMonth, "yyyy-MM");
      await clearPayrollCaches(monthKey);

      // Fetch fresh data
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
    } finally {
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

  // Add a function to render the data source indicator with badge
  const renderDataSourceIndicator = () => {
    // Match the style from Users and Companies pages
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

    // Get user-friendly name of the data source
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

  // Ensure summaries is always an array before passing to DataTable
  const ensureArray = (data: any): MonthlyPayrollSummary[] => {
    if (!data) return [];
    if (!Array.isArray(data)) {
      console.error("Expected array but got:", data);
      return [];
    }
    return data;
  };

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        <PaychecksHeader
          summaries={summaries}
          loading={isLoading}
          dataSource={dataSource}
          selectedMonth={selectedMonth}
          onGeneratePayroll={() => setIsAdvancedPayrollDialogOpen(true)}
          onClearCache={invalidateCache}
        />

        <div className="flex items-center justify-between">
          <MonthPicker
            selected={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </div>

        <DataTable
          columns={columns}
          data={summaries}
          isLoading={isLoading}
          onViewTransactions={handleViewTransactions}
          lastUpdatedUserId={lastUpdatedUserId}
          emptyMessage={`No payroll data found for ${format(selectedMonth, "MMMM yyyy")}`}
        />

        {isAdvancedPayrollDialogOpen && (
          <GeneratePayrollDialog
            open={isAdvancedPayrollDialogOpen}
            onOpenChange={setIsAdvancedPayrollDialogOpen}
            onSuccess={handlePayrollDialogSuccess}
          />
        )}

        {isTransactionsDialogOpen && selectedUserId && (
          <TransactionsDialog
            open={isTransactionsDialogOpen}
            onOpenChange={handleTransactionsDialogClose}
            userId={selectedUserId}
            onTransactionUpdated={handleTransactionUpdated}
          />
        )}
      </div>
    </ErrorBoundary>
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
