import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Database,
  RefreshCw,
  Plus,
  Calculator,
  DollarSign,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MonthlyPayrollSummary } from "../types";

interface PaychecksHeaderProps {
  summaries: MonthlyPayrollSummary[];
  loading: boolean;
  dataSource: "cache" | "database";
  selectedMonth: Date;
  onGeneratePayroll: () => void;
  onClearCache: () => void;
}

export function PaychecksHeader({
  summaries,
  loading,
  dataSource,
  selectedMonth,
  onGeneratePayroll,
  onClearCache,
}: PaychecksHeaderProps) {
  const totalPayroll = summaries.reduce(
    (sum, s) => sum + (s.total_amount || 0),
    0
  );
  const paidPayroll = summaries.reduce(
    (sum, s) => sum + (s.paid_amount || 0),
    0
  );
  const pendingPayroll = summaries.reduce(
    (sum, s) => sum + (s.pending_amount || 0),
    0
  );
  const totalEmployees = summaries.length;

  return (
    <>
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-none rounded-lg shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Paychecks
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage payroll and employee compensation for{" "}
              {format(selectedMonth, "MMMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-md text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <Database className="h-3.5 w-3.5" />
              <span className="font-medium">
                {dataSource === "cache" ? "Cache" : "Database"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearCache}
              className="h-9"
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
              />
              Clear Cache
            </Button>
            <Button
              size="sm"
              onClick={onGeneratePayroll}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Generate Payroll
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Total Payroll
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `$${totalPayroll.toLocaleString()}`
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Paid Amount
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `$${paidPayroll.toLocaleString()}`
                )}
              </span>
              <div className="flex items-center ml-2 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20 rounded-full px-1.5 py-0.5">
                {totalPayroll > 0
                  ? Math.round((paidPayroll / totalPayroll) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
              <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Pending Amount
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `$${pendingPayroll.toLocaleString()}`
                )}
              </span>
              <div className="flex items-center ml-2 text-xs font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 rounded-full px-1.5 py-0.5">
                {totalPayroll > 0
                  ? Math.round((pendingPayroll / totalPayroll) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20">
              <Calculator className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Total Employees
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  totalEmployees
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
