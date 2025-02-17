"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PayrollDialog } from "./components/payroll-dialog";
import { useToast } from "@/components/ui/use-toast";
import { PayrollTransaction } from "./types";
import { GeneratePayrollButton } from "./components/generate-payroll-button";
import { createClient } from "@/utils/supabase/client";
import { ErrorBoundary } from "./components/error-boundary";
import { DebugPanel } from "./components/debug-panel";
import { MonthPicker } from "@/components/ui/month-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { TransactionsDialog } from "./components/transactions-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { ShiftSchedule } from "./components/shift-schedule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Add this type for payment status
type OverallStatus = "paid" | "partially_paid" | "pending" | "unpaid";

// Update the MonthlyPayrollSummary interface
interface MonthlyPayrollSummary {
  user_id: string;
  month: string;
  first_name: string;
  last_name: string;
  email: string;
  base_payment: number;
  advances: number;
  penalties: number;
  bonuses: number;
  transaction_ids: number[];
  paid_amount: number;
  total_amount: number;
  pending_amount: number;
  pending_penalties: number;
  deducted_penalties: number;
}

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

// Add this type if not already present
type TransactionType = "payment" | "advance" | "penalty" | "bonus";
type PaymentStatus = "pending" | "paid" | "unpaid" | "charged" | "deducted";

interface PaycheckSummary {
  basePayment: number;
  advances: number;
  penalties: number;
  bonuses: number;
  total: number;
  status: string;
  paidAmount: number;
  pendingAmount: number;
}

const calculateUserSummary = (transactions: any[]): PaycheckSummary => {
  const summary = {
    basePayment: 0,
    advances: 0,
    penalties: 0,
    bonuses: 0,
    total: 0,
    paidAmount: 0,
    pendingAmount: 0,
    status: "Pending",
  };

  transactions.forEach((t) => {
    const amount = t.amount;

    switch (t.transaction_type) {
      case "payment":
        summary.basePayment += amount;
        if (t.status === "paid") {
          summary.paidAmount += amount;
        } else if (t.status === "pending") {
          summary.pendingAmount += amount;
        }
        break;

      case "bonus":
        summary.bonuses += amount;
        if (t.status === "paid") {
          summary.paidAmount += amount;
        } else if (t.status === "pending") {
          summary.pendingAmount += amount;
        }
        break;

      case "advance":
        summary.advances += amount;
        if (t.status === "paid") {
          summary.paidAmount -= amount;
        } else if (t.status === "pending") {
          summary.pendingAmount += amount;
        }
        break;

      case "penalty":
        if (t.status === "charged") {
          summary.penalties += amount;
          summary.paidAmount -= amount;
        } else if (t.status === "pending") {
          summary.pendingAmount += amount;
        }
        break;
    }
  });

  // Calculate total: base + bonus - (advances + charged penalties)
  summary.total =
    summary.basePayment +
    summary.bonuses -
    summary.advances -
    summary.penalties;

  // Ensure amounts don't go below zero
  summary.paidAmount = Math.max(0, summary.paidAmount);
  summary.pendingAmount = Math.max(0, summary.pendingAmount);

  // Determine overall status
  if (summary.paidAmount === 0 && summary.pendingAmount === 0) {
    summary.status = "Unpaid";
  } else if (summary.pendingAmount > 0) {
    summary.status = "Partially Paid";
  } else {
    summary.status = "Paid";
  }

  return summary;
};

export default function PaychecksPage() {
  return (
    <ErrorBoundary>
      <PaychecksContent />
    </ErrorBoundary>
  );
}

function PaychecksContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [summaries, setSummaries] = useState<MonthlyPayrollSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const supabase = createClient();

  // Add state for debug info
  const [debugInfo, setDebugInfo] = useState<{ data: any; error: any }>({
    data: null,
    error: null,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Add state for transactions dialog
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>(
    []
  );

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

  const fetchMonthlySummary = async () => {
    try {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      console.log("Fetching data for:", {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      });

      // First get the monthly summary
      const { data: summaryData, error: summaryError } = await supabase
        .from("monthly_payroll_summary")
        .select("*");

      if (summaryError) {
        console.error("Supabase error:", summaryError);
        throw summaryError;
      }

      // Then get the transactions for the selected month
      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("payroll_transactions")
          .select(
            "id, user_id, amount, status, transaction_date, transaction_type"
          )
          .gte("transaction_date", monthStart.toISOString())
          .lt("transaction_date", monthEnd.toISOString())
          .neq("status", "cancelled");

      if (transactionsError) {
        console.error("Supabase error:", transactionsError);
        throw transactionsError;
      }

      // Create a map of user_id to transaction_ids for the selected month
      const transactionMap = new Map<string, number[]>();
      (transactionsData as PayrollTransactionSummary[]).forEach((t) => {
        const ids = transactionMap.get(t.user_id) || [];
        ids.push(t.id);
        transactionMap.set(t.user_id, ids);
      });

      // Calculate total and paid amounts
      const combinedData = summaryData.map((summary) => {
        const transactions = (
          transactionsData as PayrollTransactionSummary[]
        ).filter((t) => t.user_id === summary.user_id);

        // Calculate base total first
        const baseTotal = summary.base_payment;

        // Handle different transaction types
        const {
          paidAmount,
          pendingAmount,
          pendingPenalties,
          deductedPenalties,
          totalBonuses,
          totalAdvances,
          totalPenalties,
        } = transactions.reduce(
          (acc, t) => {
            const amount = t.amount;
            switch (t.transaction_type) {
              case "bonus":
                acc.totalBonuses += amount;
                if (t.status === "paid") acc.paidAmount += amount;
                if (t.status === "pending") acc.pendingAmount += amount;
                break;
              case "penalty":
                if (t.status === "charged") {
                  acc.totalPenalties += amount;
                  acc.paidAmount -= amount;
                }
                if (t.status === "pending") acc.pendingPenalties += amount;
                break;
              case "advance":
                acc.totalAdvances += amount;
                if (t.status === "paid") {
                  acc.paidAmount -= amount;
                }
                if (t.status === "pending") acc.pendingAmount += amount;
                break;
              case "payment":
                if (t.status === "paid") acc.paidAmount += amount;
                if (t.status === "pending") acc.pendingAmount += amount;
                break;
            }
            return acc;
          },
          {
            paidAmount: 0,
            pendingAmount: 0,
            pendingPenalties: 0,
            deductedPenalties: 0,
            totalBonuses: 0,
            totalAdvances: 0,
            totalPenalties: 0,
          }
        );

        // Final total calculation:
        // base + bonuses - (advances + penalties)
        const total = baseTotal + totalBonuses - totalAdvances - totalPenalties;

        return {
          ...summary,
          transaction_ids: transactions.map((t) => t.id),
          total_amount: total,
          paid_amount: Math.max(0, paidAmount),
          pending_amount: Math.max(0, pendingAmount),
          pending_penalties: pendingPenalties,
          deducted_penalties: deductedPenalties,
        };
      });

      console.log("Combined data:", combinedData);
      setSummaries(combinedData);
      setDebugInfo((prev) => ({ ...prev, data: combinedData }));
    } catch (error) {
      console.error("Error fetching summary:", error);
      setDebugInfo((prev) => ({ ...prev, error }));
      toast({
        title: "Error",
        description: "Failed to load payroll summary",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth]);

  const onTransactionCreated = () => {
    fetchMonthlySummary();
  };

  const viewTransactions = (userId: string) => {
    setSelectedUserId(userId);
    setTransactionsDialogOpen(true);
  };

  const addTransaction = (userId: string) => {
    setSelectedUserId(userId);
    setDialogOpen(true);
  };

  // Move columns definition here so it has access to the handlers
  const columns: ColumnDef<MonthlyPayrollSummary>[] = [
    {
      accessorKey: "employee",
      header: "Employee",
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div>
            <div className="font-medium">
              {data.first_name} {data.last_name}
            </div>
            <div className="text-sm text-muted-foreground">{data.email}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "base_payment",
      header: "Base Payment",
      cell: ({ row }) => {
        const amount = row.getValue("base_payment") as number;
        return <div className="font-medium">${amount.toFixed(2)}</div>;
      },
    },
    {
      accessorKey: "advances",
      header: "Advances",
      cell: ({ row }) => {
        const amount = row.getValue("advances") as number;
        return amount > 0 ? (
          <div className="text-yellow-600">${amount.toFixed(2)}</div>
        ) : null;
      },
    },
    {
      accessorKey: "penalties",
      header: "Penalties",
      cell: ({ row }) => {
        const amount = row.getValue("penalties") as number;
        return amount > 0 ? (
          <div className="text-red-600">${amount.toFixed(2)}</div>
        ) : null;
      },
    },
    {
      accessorKey: "bonuses",
      header: "Bonuses",
      cell: ({ row }) => {
        const amount = row.getValue("bonuses") as number;
        return amount > 0 ? (
          <div className="text-green-600">${amount.toFixed(2)}</div>
        ) : null;
      },
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) => {
        const data = row.original;
        return <div className="font-bold">${data.total_amount.toFixed(2)}</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const data = row.original;
        const status = getOverallStatus(data);
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
              status
            )}`}
          >
            {status === "partially_paid"
              ? "Partially Paid"
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      accessorKey: "paid_amount",
      header: "Paid Amount",
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">${data.paid_amount.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              of ${data.total_amount.toFixed(2)}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const data = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => viewTransactions(data.user_id)}>
                View Transactions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addTransaction(data.user_id)}>
                Add Transaction
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="px-4 py-10 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Monthly Payroll</h1>
          <MonthPicker
            selected={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      <div className="space-y-4">
        <DataTable columns={columns} data={summaries} isLoading={isLoading} />
      </div>

      <PayrollDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={onTransactionCreated}
        defaultUserId={selectedUserId}
      />

      <TransactionsDialog
        open={transactionsDialogOpen}
        onOpenChange={setTransactionsDialogOpen}
        onTransactionUpdated={fetchMonthlySummary}
        userId={selectedUserId || undefined}
      />

      {/* {process.env.NODE_ENV === "development" && (
        <DebugPanel data={debugInfo.data} error={debugInfo.error} />
      )} */}
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

// Add these functions to your components to use mock data
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
