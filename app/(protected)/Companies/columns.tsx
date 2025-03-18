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
    }
  > = {
    active: {
      variant: "success",
      label: "Active",
      icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
    },
    trialing: {
      variant: "secondary",
      label: "Trial",
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
    past_due: {
      variant: "destructive",
      label: "Past Due",
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
    },
    canceled: {
      variant: "outline",
      label: "Canceled",
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    incomplete: {
      variant: "outline",
      label: "Incomplete",
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
    },
    incomplete_expired: {
      variant: "outline",
      label: "Expired",
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    unpaid: {
      variant: "destructive",
      label: "Unpaid",
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
    },
    paused: {
      variant: "secondary",
      label: "Paused",
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
  };

  const config = variants[status] || {
    variant: "outline",
    label: status,
    icon: null,
  };

  return (
    <Badge variant={config.variant} className="h-6 badge">
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
    }
  > = {
    paid: {
      variant: "success",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    open: {
      variant: "secondary",
      icon: <Clock className="h-3 w-3" />,
    },
    void: {
      variant: "outline",
      icon: <XCircle className="h-3 w-3" />,
    },
    uncollectible: {
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const config = variants[status] || { variant: "outline", icon: null };

  // Return a more compact badge with just the icon for most statuses
  if (status === "paid") {
    return (
      <Badge variant={config.variant} className="h-6 px-2 badge">
        {config.icon}
        <span className="ml-1">Paid</span>
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} className="h-6 px-2 badge">
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

      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{formatCurrency(amount)}</span>
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
        <div className="flex items-center space-x-2">
          {lastInvoiceStatus && getInvoiceStatusBadge(lastInvoiceStatus)}
          {lastInvoiceDate && (
            <div
              className="text-xs text-muted-foreground cursor-help"
              title={formatDate(lastInvoiceDate)}
            >
              <Clock className="h-3.5 w-3.5" />
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
          variant={status === "active" ? "success" : "secondary"}
          className="h-6"
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
