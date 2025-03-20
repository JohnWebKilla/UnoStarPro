import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Company } from "../types";
import { ColumnDef } from "@tanstack/react-table";

// Helper function to format dates
function formatDate(date: string | undefined | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

// Helper function to get invoice status badge
function getInvoiceStatusBadge(status: string | undefined | null) {
  if (!status) return null;

  const variants: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline" | "success";
      icon: React.ReactNode;
    }
  > = {
    paid: {
      variant: "success",
      icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
    },
    open: {
      variant: "secondary",
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
    void: {
      variant: "outline",
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    uncollectible: {
      variant: "destructive",
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
    },
  };

  const config = variants[status] || { variant: "outline", icon: null };

  return (
    <Badge variant={config.variant} className="h-6">
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export const invoiceColumns: ColumnDef<Company>[] = [
  {
    accessorKey: "last_invoice",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <Receipt className="mr-2 h-4 w-4" />
          Last Invoice
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // These fields might not exist yet in the database
      const lastInvoiceDate = row.original.last_invoice_date as
        | string
        | undefined
        | null;
      const lastInvoiceStatus = row.original.last_invoice_status as
        | string
        | undefined
        | null;
      const hasStripeCustomer = !!row.original.stripe_customer_id;

      if (!hasStripeCustomer) {
        return <div className="text-muted-foreground">No Stripe account</div>;
      }

      if (!lastInvoiceDate && !lastInvoiceStatus) {
        return <div className="text-muted-foreground">No invoices yet</div>;
      }

      return (
        <div className="flex flex-col space-y-1">
          {lastInvoiceDate && (
            <div className="text-sm">{formatDate(lastInvoiceDate)}</div>
          )}
          {lastInvoiceStatus && getInvoiceStatusBadge(lastInvoiceStatus)}
        </div>
      );
    },
  },
  {
    accessorKey: "stripe",
    header: "Stripe",
    cell: ({ row }) => {
      const hasStripe = row.original.stripe_customer_id;
      const hasPaymentMethod = row.original.stripe_payment_method_id;

      if (!hasStripe) {
        return (
          <Badge variant="outline" className="h-6">
            Not Connected
          </Badge>
        );
      }

      if (!hasPaymentMethod) {
        return (
          <Badge variant="destructive" className="h-6">
            <AlertCircle className="mr-1 h-3 w-3" />
            No Payment
          </Badge>
        );
      }

      return (
        <Badge variant="success" className="h-6">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Connected
        </Badge>
      );
    },
  },
];
