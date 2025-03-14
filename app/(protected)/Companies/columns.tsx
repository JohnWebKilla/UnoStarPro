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
} from "lucide-react";

function formatDate(date: string | undefined | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
    }
  > = {
    active: { variant: "success", label: "Active" },
    trialing: { variant: "secondary", label: "Trial" },
    past_due: { variant: "destructive", label: "Past Due" },
    canceled: { variant: "outline", label: "Canceled" },
    incomplete: { variant: "outline", label: "Incomplete" },
    incomplete_expired: { variant: "outline", label: "Expired" },
    unpaid: { variant: "destructive", label: "Unpaid" },
    paused: { variant: "secondary", label: "Paused" },
  };

  const config = variants[status] || { variant: "outline", label: status };

  return (
    <Badge variant={config.variant} className="h-6">
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
      icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
    },
    open: { variant: "secondary", icon: <Clock className="mr-1 h-3 w-3" /> },
    void: { variant: "outline", icon: <XCircle className="mr-1 h-3 w-3" /> },
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

export const columns: ColumnDef<Company>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Company
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      const stripeId = row.original.stripe_customer_id;
      return (
        <div className="flex flex-col space-y-1">
          <span className="font-medium">{name}</span>
          {stripeId && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {stripeId}
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
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Contact
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const firstName = row.original.contact_first_name;
      const lastName = row.original.contact_last_name;
      return (
        <div>{firstName || lastName ? `${firstName} ${lastName}` : "-"}</div>
      );
    },
  },
  {
    accessorKey: "contact_email",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const email = row.original.contact_email;
      return <div>{email || "-"}</div>;
    },
  },
  {
    accessorKey: "contact_phone",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Phone
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const phone = row.original.contact_phone;
      return <div>{phone || "-"}</div>;
    },
  },
  {
    accessorKey: "subscription_amount",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Subscription
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const amount = row.getValue("subscription_amount") as number;
      const hasSubscription = row.original.stripe_subscription_id;
      const status = row.original.subscription_status;

      return (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2">
            <span>{formatCurrency(amount)}</span>
            {status && getSubscriptionStatusBadge(status)}
          </div>
          {hasSubscription && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
              {row.original.stripe_subscription_id}
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
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Invoice
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const lastInvoiceDate = row.original.last_invoice_date;
      const lastInvoiceStatus = row.original.last_invoice_status;

      if (!lastInvoiceDate) {
        return <div>-</div>;
      }

      return (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-3 w-3 text-muted-foreground" />
            <span>{formatDate(lastInvoiceDate)}</span>
          </div>
          {lastInvoiceStatus && (
            <div>{getInvoiceStatusBadge(lastInvoiceStatus)}</div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div>
          <Badge
            variant={status === "active" ? "default" : "secondary"}
            className="h-6"
          >
            {status}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "stripe_status",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-0 h-8 font-medium hover:bg-transparent hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stripe
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const stripeId = row.original.stripe_customer_id;
      const lastSynced = row.original.last_synced_at;
      const hasPaymentMethod = row.original.stripe_payment_method_id;

      if (!stripeId) {
        return (
          <div>
            <Badge variant="secondary" className="h-6">
              Not Connected
            </Badge>
          </div>
        );
      }

      return (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-1">
            <Badge
              variant={hasPaymentMethod ? "default" : "secondary"}
              className="h-6"
            >
              <CreditCard className="mr-1 h-3 w-3" />
              {hasPaymentMethod ? "Active" : "No Payment"}
            </Badge>
            {stripeId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={`https://dashboard.stripe.com/customers/${stripeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
          {lastSynced && (
            <span className="text-[11px] text-muted-foreground">
              {formatDate(lastSynced)}
            </span>
          )}
        </div>
      );
    },
  },
];
