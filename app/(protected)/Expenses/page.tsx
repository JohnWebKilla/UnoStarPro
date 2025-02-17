"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ExpenseDialog } from "./components/expense-dialog";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { MonthPicker } from "@/components/ui/month-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { CategoryManagementDialog } from "./components/category-management-dialog";

interface Expense {
  id: number;
  category_id: number;
  category_name: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_status: string;
  payment_method: string;
  receipt_url: string | null;
  created_by_user?: { email: string };
  updated_by_user?: { email: string };
}

const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: "category_name",
    header: "Category",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);

      return formatted;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "expense_date",
    header: "Date",
    cell: ({ row }) => {
      return format(new Date(row.getValue("expense_date")), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "payment_status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("payment_status") as string;
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status === "paid"
              ? "bg-green-100 text-green-800"
              : status === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    },
  },
  {
    accessorKey: "payment_method",
    header: "Payment Method",
  },
  {
    accessorKey: "created_by_user",
    header: "Created By",
    cell: ({ row }) => row.original.created_by_user?.email || "System",
  },
  {
    accessorKey: "updated_by_user",
    header: "Last Modified By",
    cell: ({ row }) => row.original.updated_by_user?.email || "System",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const expense = row.original;

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
            <DropdownMenuItem
              onClick={() => {
                // Add edit functionality
              }}
            >
              Edit Expense
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // Add delete functionality
              }}
              className="text-red-600"
            >
              Delete Expense
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function ExpensesPage() {
  return (
    <ErrorBoundary>
      <ExpensesContent />
    </ErrorBoundary>
  );
}

function ExpensesContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();
  const supabase = createClient();
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const fetchExpenses = async () => {
    try {
      setIsLoadingData(true);
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      if (!user) return;

      // First, ensure payroll expenses are up to date
      await supabase.rpc("sync_monthly_payroll", {
        month_date: monthStart.toISOString(),
        user_id: user.id,
      });

      // Then fetch all expenses including payroll
      const { data, error } = await supabase
        .from("expenses")
        .select(
          `
          *,
          expense_categories (name),
          created_by_user:created_by(email),
          updated_by_user:updated_by(email)
        `
        )
        .gte("expense_date", monthStart.toISOString())
        .lt("expense_date", monthEnd.toISOString())
        .order("expense_date", { ascending: false });

      if (error) throw error;

      const formattedData =
        data?.map((expense) => ({
          ...expense,
          category_name: expense.expense_categories.name,
          amount:
            typeof expense.amount === "string"
              ? parseFloat(expense.amount)
              : expense.amount,
        })) || [];

      setExpenses(formattedData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [selectedMonth, user]);

  const calculateSummary = () => {
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const payrollExpense =
      expenses.find((e) => e.category_name === "Payroll")?.amount || 0;
    const otherExpenses = totalExpenses - payrollExpense;

    return {
      total: totalExpenses,
      payroll: payrollExpense,
      other: otherExpenses,
    };
  };

  const summary = calculateSummary();

  return (
    <div className="px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Expenses</h1>
          <MonthPicker
            selected={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCategoryManagementOpen(true)}
          >
            Manage Categories
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-card rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Expenses
          </h3>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(summary.total)}
          </p>
        </div>
        <div className="p-4 bg-card rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Payroll</h3>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(summary.payroll)}
          </p>
        </div>
        <div className="p-4 bg-card rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Other Expenses
          </h3>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(summary.other)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={expenses}
          isLoading={isLoadingData}
          isInitializing={isInitializing}
        />
      </div>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchExpenses}
      />

      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
      />
    </div>
  );
}
