import { ColumnDef } from "@tanstack/react-table";
import { Company } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
  Building2,
  Mail,
  Phone,
} from "lucide-react";
import { PaymentStatusBadge } from "./payment-status-badge";
import { cn } from "@/lib/utils";

function formatDate(date: string | undefined | null): {
  datePart: string;
  timePart: string;
} {
  if (!date) return { datePart: "-", timePart: "" };

  try {
    const dateObj = new Date(date);

    // Format date part: Mar 18, 2025
    const datePart = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Format time part: 1:22 PM
    const timePart = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });

    return { datePart, timePart };
  } catch (error) {
    console.error("Error formatting date:", error);
    return { datePart: "-", timePart: "" };
  }
}

function formatCurrency(amount: number) {
  return amount ? `$${(amount / 100).toFixed(2)}` : "$0.00";
}

function getSubscriptionStatusBadge(status: string | undefined | null) {
  if (!status) return null;

  const variants: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline" | "success";
      label: string;
      icon: React.ReactNode;
      className?: string;
    }
  > = {
    active: {
      variant: "success",
      label: "Active",
      icon: <CheckCircle2 className="h-3 w-3" />,
      className:
        "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30",
    },
    trialing: {
      variant: "secondary",
      label: "Trial",
      icon: <Clock className="h-3 w-3" />,
      className:
        "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 border-blue-500/20 dark:border-blue-500/30",
    },
    past_due: {
      variant: "destructive",
      label: "Past Due",
      icon: <AlertCircle className="h-3 w-3" />,
      className:
        "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30 border-red-500/20 dark:border-red-500/30",
    },
    canceled: {
      variant: "outline",
      label: "Canceled",
      icon: <XCircle className="h-3 w-3" />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    incomplete: {
      variant: "outline",
      label: "Incomplete",
      icon: <AlertCircle className="h-3 w-3" />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    incomplete_expired: {
      variant: "outline",
      label: "Expired",
      icon: <XCircle className="h-3 w-3" />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    unpaid: {
      variant: "destructive",
      label: "Unpaid",
      icon: <AlertCircle className="h-3 w-3" />,
      className:
        "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20 dark:hover:bg-orange-500/30 border-orange-500/20 dark:border-orange-500/30",
    },
    paused: {
      variant: "secondary",
      label: "Paused",
      icon: <Clock className="h-3 w-3" />,
      className:
        "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-500/20 dark:hover:bg-purple-500/30 border-purple-500/20 dark:border-purple-500/30",
    },
  };

  const config = variants[status] || {
    variant: "outline",
    label: status,
    icon: null,
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
  };

  return (
    <Badge
      variant={config.variant}
      className={cn("h-6 badge", config.className)}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

function getInvoiceStatusBadge(status: string | undefined | null) {
  if (!status) return null;

  const variants: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline" | "success";
      icon: React.ReactNode;
      className?: string;
    }
  > = {
    paid: {
      variant: "success",
      icon: <CheckCircle2 className="h-3 w-3" />,
      className:
        "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30",
    },
    open: {
      variant: "secondary",
      icon: <Clock className="h-3 w-3" />,
      className:
        "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30 border-yellow-500/20 dark:border-yellow-500/30",
    },
    void: {
      variant: "outline",
      icon: <XCircle className="h-3 w-3" />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    uncollectible: {
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
      className:
        "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30 border-red-500/20 dark:border-red-500/30",
    },
  };

  const config = variants[status] || { variant: "outline", icon: null };

  // Return a more compact badge with just the icon for most statuses
  if (status === "paid") {
    return (
      <Badge
        variant={config.variant}
        className={cn("h-6 px-2 badge", config.className)}
      >
        {config.icon}
        <span className="ml-1">Paid</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant={config.variant}
      className={cn("h-6 px-2 badge", config.className)}
    >
      {config.icon}
    </Badge>
  );
}

// Add a function to format phone numbers in US format
function formatPhoneNumber(phone: string | undefined | null) {
  if (!phone) return "-";

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Check for valid US phone number length
  if (cleaned.length !== 10) {
    return phone; // Return original if not 10 digits
  }

  // Format as (XXX) XXX-XXXX
  return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
}

// Create a helper function for formatting the entire date as a string for tooltips
function formatDateAsString(date: string | undefined | null): string {
  if (!date) return "-";
  const { datePart, timePart } = formatDate(date);
  return `${datePart} ${timePart}`;
}

// Simplify the formatDate function to return a cleaner date format
function formatShortDate(date: string | undefined | null): string {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}

export const columns: ColumnDef<Company>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <Building2 className="mr-2 h-4 w-4" />
          Company
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      const stripeId = row.original.stripe_customer_id;
      return (
        <div className="flex items-center">
          <span className="font-medium">{name}</span>
          {stripeId && (
            <span
              className="ml-1.5 cursor-help"
              title={`Stripe ID: ${stripeId}`}
            >
              <CreditCard className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "contact_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Contact
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const firstName = row.original.contact_first_name;
      const lastName = row.original.contact_last_name;

      return (
        <div className="font-medium">
          {firstName || lastName ? `${firstName} ${lastName}` : "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "contact_email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const email = row.original.contact_email;

      if (!email) return <div className="text-muted-foreground">-</div>;

      return (
        <a
          href={`mailto:${email}`}
          className="hover:underline truncate text-sm"
        >
          {email}
        </a>
      );
    },
  },
  {
    accessorKey: "contact_phone",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Phone
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const phone = row.original.contact_phone;

      if (!phone) return <div className="text-muted-foreground">-</div>;

      const formattedPhone = formatPhoneNumber(phone);

      return (
        <a href={`tel:${phone}`} className="hover:underline text-sm">
          {formattedPhone}
        </a>
      );
    },
  },
  {
    accessorKey: "subscription",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Subscription
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const amount = row.original.subscription_amount;
      const status = row.original.subscription_status;
      const subscriptionId = row.original.stripe_subscription_id;

      // Show amount
      const amountDisplay = (
        <span className="font-medium">{formatCurrency(amount)}</span>
      );

      return (
        <div className="flex items-center gap-2">
          {amountDisplay}
          {status && getSubscriptionStatusBadge(status)}
          {subscriptionId && (
            <span
              className="cursor-help"
              title={`Subscription ID: ${subscriptionId}`}
            >
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </div>
      );
    },
  },
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
      const lastInvoiceDate = row.original.last_invoice_date;
      const lastInvoiceStatus = row.original.last_invoice_status;

      if (!lastInvoiceDate && !lastInvoiceStatus) {
        return <div className="text-muted-foreground">No invoices yet</div>;
      }

      return (
        <div className="flex items-center gap-2">
          {lastInvoiceStatus && getInvoiceStatusBadge(lastInvoiceStatus)}
          {lastInvoiceDate && (
            <div className="text-xs text-muted-foreground">
              {formatShortDate(lastInvoiceDate)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={status === "active" ? "success" : "destructive"}
          className={cn(
            "h-6",
            status === "active"
              ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30"
              : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30 border-red-500/20 dark:border-red-500/30"
          )}
        >
          {status === "active" ? (
            <CheckCircle2 className="mr-1 h-3 w-3" />
          ) : (
            <XCircle className="mr-1 h-3 w-3" />
          )}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "stripe",
    header: "Stripe",
    cell: ({ row }) => {
      return <PaymentStatusBadge company={row.original} />;
    },
  },
];
