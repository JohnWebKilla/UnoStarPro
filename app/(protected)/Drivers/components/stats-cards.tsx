"use client";

import { useDrivers } from "./DriversClientProvider";
import {
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsCards() {
  const { drivers } = useDrivers();

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(
    (d) => d.status?.toLowerCase() === "active"
  ).length;
  const inactiveDrivers = totalDrivers - activeDrivers;
  const totalRevenue = drivers.reduce((sum, d) => {
    if (d.status?.toLowerCase() !== "active") return sum;

    const amount = d.subscription?.amount || d.subscription_amount || 0;
    return sum + Math.round(amount);
  }, 0);

  const expiringDocuments = drivers.reduce((sum, d) => {
    const allDocs = [
      ...(Array.isArray(d.documents) ? d.documents : []),
      ...(Array.isArray(d.driver_licenses) ? d.driver_licenses : []),
      ...(Array.isArray(d.medical_cards) ? d.medical_cards : []),
      ...(Array.isArray(d.mvr_files) ? d.mvr_files : []),
    ];

    const hasExpiringDocs = allDocs.some((doc) => {
      if (!doc) return false;
      const expiryDate = new Date(
        "expiryDate" in doc && doc.expiryDate
          ? doc.expiryDate
          : "expiration_date" in doc
            ? doc.expiration_date
            : ""
      );
      if (isNaN(expiryDate.getTime())) return false;
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate <= thirtyDaysFromNow;
    });

    return sum + (hasExpiringDocs ? 1 : 0);
  }, 0);

  const expiringPercentage =
    totalDrivers > 0 ? Math.round((expiringDocuments / totalDrivers) * 100) : 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Drivers
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {totalDrivers}
            </span>
            <div className="flex items-center ml-2 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20 rounded-full px-1.5 py-0.5">
              {Math.round((activeDrivers / (totalDrivers || 1)) * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
            <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Status
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {activeDrivers}
            </span>
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {Math.round((activeDrivers / totalDrivers) * 100)}% active
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20">
            <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Revenue
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(totalRevenue)}
            </span>
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              /mo
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Issues
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {expiringDocuments}
            </span>
            <span
              className={cn(
                "ml-2 text-xs font-medium rounded-full px-1.5 py-0.5",
                expiringPercentage === 0
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20"
                  : expiringPercentage <= 10
                    ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20"
                    : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20"
              )}
            >
              {expiringPercentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
