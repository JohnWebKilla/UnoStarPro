"use client";

import { Company } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, CreditCard, AlertTriangle, DollarSign } from "lucide-react";

interface SummaryCardsProps {
  companies: Company[];
}

export function SummaryCards({ companies }: SummaryCardsProps) {
  // Calculate metrics
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "active").length;

  const activeSubscriptions = companies.filter(
    (c) =>
      c.subscription_status === "active" || c.subscription_status === "trialing"
  ).length;

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

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCompanies}</div>
          <p className="text-xs text-muted-foreground">
            {activeCompanies} active (
            {Math.round((activeCompanies / totalCompanies) * 100) || 0}%)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Active Subscriptions
          </CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeSubscriptions}</div>
          <p className="text-xs text-muted-foreground">
            {Math.round((activeSubscriptions / totalCompanies) * 100) || 0}% of
            companies
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalSubscriptionRevenue)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(totalSubscriptionRevenue / (totalCompanies || 1))}{" "}
            avg. per company
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payment Issues</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{companiesWithPaymentIssues}</div>
          <p className="text-xs text-muted-foreground">
            {Math.round((companiesWithPaymentIssues / totalCompanies) * 100) ||
              0}
            % of companies
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
