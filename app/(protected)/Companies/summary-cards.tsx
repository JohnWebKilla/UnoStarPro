"use client";

import {
  Building,
  CreditCard,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanies } from "./components/CompaniesClientProvider";

export function SummaryCards() {
  const { companies } = useCompanies();

  // Calculate metrics
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "active").length;
  const activePercentage =
    Math.round((activeCompanies / totalCompanies) * 100) || 0;
  const activePercentageChange = activePercentage - 50; // Example trend, replace with actual calculation

  const activeSubscriptions = companies.filter(
    (c) =>
      c.subscription_status === "active" ||
      c.subscription_status === "trialing" ||
      (c.stripe_subscription_id &&
        c.subscription_amount > 0 &&
        c.status === "active")
  ).length;
  const subscriptionPercentage =
    Math.round((activeSubscriptions / totalCompanies) * 100) || 0;

  const totalSubscriptionRevenue = companies.reduce(
    (sum, company) => sum + (company.subscription_amount || 0),
    0
  );

  const companiesWithPaymentIssues = companies.filter(
    (c) =>
      c.subscription_status === "past_due" ||
      c.subscription_status === "unpaid" ||
      c.last_invoice_status === "uncollectible" ||
      (c.stripe_customer_id && !c.stripe_payment_method_id)
  ).length;
  const issuesPercentage =
    Math.round((companiesWithPaymentIssues / totalCompanies) * 100) || 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
            <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Companies
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {totalCompanies}
            </span>
            <div
              className={cn(
                "flex items-center ml-2 text-xs font-medium rounded-full px-1.5 py-0.5",
                activePercentageChange > 0
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20"
                  : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20"
              )}
            >
              {activePercentageChange > 0 ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {activePercentage}%
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
            <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            Subscriptions
          </p>
          <div className="flex items-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {activeSubscriptions}
            </span>
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {subscriptionPercentage}% active
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
              {formatCurrency(totalSubscriptionRevenue)}
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
              {companiesWithPaymentIssues}
            </span>
            <span
              className={cn(
                "ml-2 text-xs font-medium",
                issuesPercentage === 0
                  ? "text-emerald-600"
                  : issuesPercentage <= 10
                    ? "text-amber-600"
                    : "text-rose-600"
              )}
            >
              {issuesPercentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
