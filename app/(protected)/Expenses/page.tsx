"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DataTable } from "./components/data-table";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  FileEdit,
  AlertTriangle,
  Download,
  BanknoteIcon,
  CircleDollarSign,
  CalendarIcon,
} from "lucide-react";
import { ExpenseDialog } from "./components/expense-dialog";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { MonthPicker } from "@/components/ui/month-picker";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { User, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { DataTableToolbar } from "./components/data-table-toolbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { CategoryManagementDialog } from "./components/category-management-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
} from "@tanstack/react-table";
import { SortingState } from "@tanstack/react-table";
import React from "react";
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";

interface Expense {
  id: number;
  category_id: number;
  expense_categories: {
    name: string;
  };
  amount: number;
  currency: "USD" | "UZS";
  amount_uzs: number | null;
  exchange_rate: number | null;
  description: string | null;
  expense_date: string;
  payment_status: "pending" | "paid" | "cancelled";
  payment_method: string | null;
  receipt_url: string | null;
  created_by_user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  updated_by_user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

function ExpensesContent(): React.ReactNode {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { toast } = useToast();
  const supabase = createClient();
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subMonths(startOfMonth(new Date()), 5),
    end: endOfMonth(new Date()),
  });
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [changedFields, setChangedFields] = useState<
    { id: number; fields: string[]; timestamp: number }[]
  >([]);
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [chartDataSource, setChartDataSource] = useState<"cache" | "database">(
    "database"
  );

  const statuses = [
    {
      value: "pending",
      label: "Pending",
      icon: React.createElement(CircleDollarSign),
    },
    {
      value: "paid",
      label: "Paid",
      icon: React.createElement(BanknoteIcon),
    },
    {
      value: "cancelled",
      label: "Cancelled",
      icon: React.createElement(AlertTriangle),
    },
  ];

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDeleteClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", selectedExpense.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });

      fetchExpenses();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddNew = () => {
    setSelectedExpense(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "expense_categories.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.expense_categories.name}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const currency = row.original.currency;
        const amount_uzs = row.original.amount_uzs;

        return (
          <div className="space-y-1">
            <div className="font-medium">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(amount)}
            </div>
            {currency === "UZS" && (
              <div className="text-sm text-muted-foreground">
                {new Intl.NumberFormat("uz-UZ", {
                  style: "currency",
                  currency: "UZS",
                }).format(amount_uzs || 0)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "currency",
      header: "Currency",
      cell: ({ row }) => {
        const currency = row.original.currency;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {currency}
          </span>
        );
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
      cell: ({ row }) => {
        const user = row.original.created_by_user;
        if (!user) return "System";
        const fullName = [user.first_name, user.last_name]
          .filter(Boolean)
          .join(" ");
        return fullName || user.email;
      },
    },
    {
      accessorKey: "updated_by_user",
      header: "Last Modified By",
      cell: ({ row }) => {
        const user = row.original.updated_by_user;
        if (!user) return "System";
        const fullName = [user.first_name, user.last_name]
          .filter(Boolean)
          .join(" ");
        return fullName || user.email;
      },
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
              <DropdownMenuItem onClick={() => handleEdit(expense)}>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit Expense
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteClick(expense)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Expense
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: expenses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoadingData(true);
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      if (!user) return;

      // Create a cache key based on the month and user
      const cacheKey = `expenses:${format(monthStart, "yyyy-MM")}:${user.id}`;

      // Try to get data from cache first using client-side cache utility
      const { data: cachedData, source } =
        await getClientCache<Expense[]>(cacheKey);

      if (cachedData) {
        setExpenses(cachedData);
        setDataSource(source);
        setIsLoadingData(false);
        setIsInitializing(false);
        return;
      }

      // First, ensure payroll expenses are up to date
      await supabase.rpc("sync_monthly_payroll", {
        month_date: monthStart.toISOString(),
        user_id: user.id,
      });

      // Then fetch all expenses including payroll
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          expense_categories (name),
          created_by_user:users(email, first_name, last_name),
          updated_by_user:users(email, first_name, last_name)
        `
        )
        .gte("expense_date", monthStart.toISOString())
        .lt("expense_date", monthEnd.toISOString())
        .order("expense_date", { ascending: false });

      if (expensesError) throw expensesError;

      const formattedData =
        expensesData?.map((expense) => ({
          ...expense,
          amount:
            typeof expense.amount === "string"
              ? parseFloat(expense.amount)
              : expense.amount,
        })) || [];

      // Store in cache for 5 minutes (300 seconds) using client-side cache utility
      await setClientCache(cacheKey, formattedData, 300);
      setDataSource("database");
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
  }, [selectedMonth, user, supabase, toast]);

  const fetchChartData = useCallback(async () => {
    try {
      if (!user) return;

      // Create a cache key based on the date range and user
      const cacheKey = `expenses:chart:${format(dateRange.start, "yyyy-MM")}:${format(dateRange.end, "yyyy-MM")}:${user.id}`;

      // Try to get data from cache first using client-side cache utility
      const { data: cachedData, source } =
        await getClientCache<any[]>(cacheKey);

      if (cachedData) {
        setChartData(cachedData);
        setChartDataSource(source);
        return;
      }

      interface ExpenseWithCategory {
        amount: number;
        currency: "USD" | "UZS";
        amount_uzs: number | null;
        expense_date: string;
        expense_categories: {
          name: string;
        };
      }

      const { data, error } = await supabase
        .from("expenses")
        .select(
          "amount, currency, amount_uzs, expense_date, expense_categories!inner(name)"
        )
        .gte("expense_date", dateRange.start.toISOString())
        .lte("expense_date", dateRange.end.toISOString())
        .returns<ExpenseWithCategory[]>();

      if (error) throw error;

      interface ChartDataPoint {
        date: string;
        total: number;
        payroll: number;
        other: number;
      }

      const groupedData = data?.reduce(
        (acc: Record<string, ChartDataPoint>, curr) => {
          const date = format(new Date(curr.expense_date), "MMM yyyy");
          const category = curr.expense_categories.name;
          const amount = curr.amount;

          if (!acc[date]) {
            acc[date] = {
              date,
              total: 0,
              payroll: 0,
              other: 0,
            };
          }

          acc[date].total += amount;
          if (category === "Payroll") {
            acc[date].payroll += amount;
          } else {
            acc[date].other += amount;
          }

          return acc;
        },
        {}
      );

      const chartData = Object.values(groupedData || {}).sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Store in cache for 5 minutes (300 seconds) using client-side cache utility
      await setClientCache(cacheKey, chartData, 300);
      setChartDataSource("database");
      setChartData(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
    }
  }, [dateRange, supabase, user]);

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
      fetchChartData();
    }
  }, [selectedMonth, user, fetchExpenses, fetchChartData]);

  const updateExpenseInPlace = (updatedExpense: Expense) => {
    setExpenses((currentExpenses) =>
      currentExpenses.map((expense) =>
        expense.id === updatedExpense.id ? updatedExpense : expense
      )
    );
    invalidateExpensesCache();
  };

  const addExpenseInPlace = (newExpense: Expense) => {
    setExpenses((currentExpenses) => [newExpense, ...currentExpenses]);
    invalidateExpensesCache();
  };

  const removeExpenseInPlace = (expenseId: number) => {
    setExpenses((currentExpenses) =>
      currentExpenses.filter((expense) => expense.id !== expenseId)
    );
    invalidateExpensesCache();
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("expenses-changes")
      .on(
        "postgres_changes" as const,
        {
          event: "*",
          schema: "public",
          table: "expenses",
        },
        async (payload: RealtimePostgresChangesPayload<Expense>) => {
          const relevantDate =
            payload.eventType === "DELETE"
              ? (payload.old as Expense | undefined)?.expense_date
              : (payload.new as Expense | undefined)?.expense_date;

          if (!relevantDate) return;

          const changeDate = new Date(relevantDate);
          const currentMonthStart = startOfMonth(selectedMonth);
          const currentMonthEnd = endOfMonth(selectedMonth);

          if (
            changeDate >= currentMonthStart &&
            changeDate <= currentMonthEnd
          ) {
            switch (payload.eventType) {
              case "UPDATE": {
                const { data: updatedExpense } = await supabase
                  .from("expenses")
                  .select(
                    `
                    *,
                    expense_categories (name),
                    created_by_user:users(email, first_name, last_name),
                    updated_by_user:users(email, first_name, last_name)
                  `
                  )
                  .eq("id", (payload.new as Expense).id)
                  .single();

                if (updatedExpense) {
                  const changedFieldsList = getChangedFields(
                    payload.old as Expense,
                    payload.new as Expense
                  );

                  if (changedFieldsList.length > 0) {
                    setChangedFields((prev) => [
                      ...prev,
                      {
                        id: updatedExpense.id,
                        fields: changedFieldsList,
                        timestamp: Date.now(),
                      },
                    ]);

                    setTimeout(() => {
                      setChangedFields((prev) =>
                        prev.filter((cf) => cf.id !== updatedExpense.id)
                      );
                    }, 2000);
                  }

                  updateExpenseInPlace(updatedExpense);
                }
                break;
              }
              case "INSERT": {
                const { data: newExpense } = await supabase
                  .from("expenses")
                  .select(
                    `
                    *,
                    expense_categories (name),
                    created_by_user:users(email, first_name, last_name),
                    updated_by_user:users(email, first_name, last_name)
                  `
                  )
                  .eq("id", (payload.new as Expense).id)
                  .single();

                if (newExpense) {
                  addExpenseInPlace(newExpense);
                }
                break;
              }
              case "DELETE": {
                removeExpenseInPlace((payload.old as Expense).id);
                break;
              }
            }
          }

          if (changeDate >= dateRange.start && changeDate <= dateRange.end) {
            fetchChartData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedMonth, dateRange, supabase, fetchChartData]);

  const calculateSummary = () => {
    const totalExpenses = expenses.reduce((sum, expense) => {
      // Always use USD amount for calculations
      return sum + expense.amount;
    }, 0);

    const payrollExpense = expenses
      .filter((e) => e.expense_categories.name === "Payroll")
      .reduce((sum, expense) => sum + expense.amount, 0);

    const otherExpenses = totalExpenses - payrollExpense;

    return {
      total: totalExpenses,
      payroll: payrollExpense,
      other: otherExpenses,
    };
  };

  const summary = calculateSummary();

  const handleExport = () => {
    const csv = [
      [
        "Category",
        "Amount (USD)",
        "Amount (UZS)",
        "Description",
        "Date",
        "Status",
        "Payment Method",
      ],
      ...expenses.map((expense) => [
        expense.expense_categories.name,
        expense.amount,
        expense.amount_uzs || "",
        expense.description,
        format(new Date(expense.expense_date), "MMM d, yyyy"),
        expense.payment_status,
        expense.payment_method,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${format(selectedMonth, "MMM-yyyy")}.csv`;
    a.click();
  };

  const getChangedFields = (oldData: Expense, newData: Expense): string[] => {
    if (!oldData || !newData) return [];

    const fieldsToCompare = [
      "category_id",
      "amount",
      "currency",
      "amount_uzs",
      "description",
      "expense_date",
      "payment_status",
      "payment_method",
    ];

    return fieldsToCompare.filter((key) => {
      const oldValue = oldData[key as keyof Expense];
      const newValue = newData[key as keyof Expense];
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    });
  };

  // Update the invalidateExpensesCache function to use client-side cache utility
  const invalidateExpensesCache = useCallback(async () => {
    if (!user) return;
    const monthStart = startOfMonth(selectedMonth);
    const cacheKey = `expenses:${format(monthStart, "yyyy-MM")}:${user.id}`;

    // Use client-side cache utility to delete cache
    await deleteClientCache(cacheKey);

    // Also invalidate chart data cache
    const chartCacheKey = `expenses:chart:${format(dateRange.start, "yyyy-MM")}:${format(dateRange.end, "yyyy-MM")}:${user.id}`;
    await deleteClientCache(chartCacheKey);
  }, [selectedMonth, dateRange, user]);

  // Add data source indicators to the UI
  const renderDataSourceIndicator = () => {
    return (
      <div className="text-xs text-muted-foreground mb-2">
        Data source: {dataSource === "cache" ? "Cache" : "Database"} | Chart
        data: {chartDataSource === "cache" ? "Cache" : "Database"}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1920px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-card p-6 rounded-lg border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Manage and track your business expenses
          </p>
          {renderDataSourceIndicator()}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <MonthPicker
            selected={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCategoryManagementOpen(true)}
              className="flex-1 sm:flex-none"
            >
              Manage Categories
            </Button>
            <Button onClick={handleAddNew} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side - Summary Cards */}
        <div className="lg:col-span-1 grid grid-cols-1 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Total Expenses
              </CardTitle>
              <CardDescription>Current month total spending</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(summary.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BanknoteIcon className="h-4 w-4" />
                Payroll
              </CardTitle>
              <CardDescription>Employee salaries and benefits</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(summary.payroll)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Other Expenses
              </CardTitle>
              <CardDescription>Non-payroll expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(summary.other)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Chart and Table */}
        <div className="lg:col-span-3 space-y-6">
          {/* Expense List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Expense List</CardTitle>
                  <CardDescription>
                    Manage and track all expenses
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsChartVisible(!isChartVisible)}
                  >
                    {isChartVisible ? "Hide Chart" : "Show Chart"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isChartVisible && (
              <CardContent className="border-b dark:border-border">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--muted-foreground)" }}
                        tickLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("en-US", {
                            notation: "compact",
                            compactDisplay: "short",
                            style: "currency",
                            currency: "USD",
                          }).format(value)
                        }
                        tick={{ fill: "var(--muted-foreground)" }}
                        tickLine={{ stroke: "var(--border)" }}
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 2,
                          }).format(value)
                        }
                        labelStyle={{ color: "var(--muted-foreground)" }}
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total Expenses"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ fill: "#8884d8", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="payroll"
                        name="Payroll"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={{ fill: "#82ca9d", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="other"
                        name="Other Expenses"
                        stroke="#ffc658"
                        strokeWidth={2}
                        dot={{ fill: "#ffc658", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            )}
            <DataTableToolbar table={table} statuses={statuses} />
            <DataTable
              columns={columns}
              data={expenses}
              table={table}
              isLoading={isLoadingData}
              isInitializing={isInitializing}
            />
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchExpenses}
        expense={selectedExpense}
        mode={dialogMode}
      />

      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-700">
              This will permanently delete the expense record.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <ErrorBoundary>
      <ExpensesContent />
    </ErrorBoundary>
  );
}
