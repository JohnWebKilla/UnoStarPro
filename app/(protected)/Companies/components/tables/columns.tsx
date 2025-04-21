import { ColumnDef } from "@tanstack/react-table";
import { Company, CompanyMeta } from "../../lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

export const columns: ColumnDef<Company>[] = [
  {
    accessorKey: "name",
    size: 250,
    header: ({ column }) => (
      <div className="flex items-center">
        <Button
          variant="ghost"
          className="p-0 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Company
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      const id = row.original.id;
      return (
        <div className="flex flex-col">
          <div className="font-medium">{name}</div>
          <div className="text-[11px] text-muted-foreground">
            cus_{id.toString(36).toUpperCase()}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "contact_name",
    size: 200,
    header: ({ column }) => (
      <div className="flex items-center">
        <Button
          variant="ghost"
          className="p-0 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Contact
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const firstName = row.original.contact_first_name;
      const lastName = row.original.contact_last_name;
      return (
        <div className="flex items-center">{`${firstName} ${lastName}`}</div>
      );
    },
  },
  {
    accessorKey: "contact_email",
    size: 250,
    header: () => <div className="flex items-center">Email</div>,
    cell: ({ row }) => {
      const email = row.original.contact_email;
      return <div className="flex items-center">{email}</div>;
    },
  },
  {
    accessorKey: "contact_phone",
    size: 150,
    header: () => <div className="flex items-center">Phone</div>,
    cell: ({ row }) => {
      const phone = row.original.contact_phone;
      return phone ? <div className="flex items-center">{phone}</div> : null;
    },
  },
  {
    accessorKey: "subscription_amount",
    size: 200,
    header: ({ column }) => (
      <div className="flex items-center">
        <Button
          variant="ghost"
          className="p-0 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Subscription
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const amount = row.original.subscription_amount;
      const stripeSubscriptionId = row.original.stripe_subscription_id;

      return (
        <div className="flex flex-col">
          <div>{amount ? formatCurrency(amount) : "$0.00"} / month</div>
          {stripeSubscriptionId && (
            <div className="text-[11px] text-muted-foreground">
              sub_{stripeSubscriptionId.substring(0, 20)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    size: 100,
    header: () => <div className="w-full text-center font-medium">Status</div>,
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div className="w-full text-center">
          <Badge
            variant="outline"
            className={cn(
              "capitalize border-emerald-600 text-emerald-600 bg-transparent hover:bg-transparent",
              status === "active"
                ? "border-emerald-600 text-emerald-600"
                : "border-zinc-600 text-zinc-600"
            )}
          >
            {status}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "stripe",
    size: 120,
    header: () => <div className="w-full text-center font-medium">Stripe</div>,
    cell: ({ row }) => {
      const company = row.original;
      const meta = (row as any).table?.options?.meta as CompanyMeta | undefined;

      return (
        <div className="w-full text-center">
          {!company.stripe_customer_id ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 inline-flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                meta?.onConnectStripe?.(company);
              }}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Connect</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 inline-flex items-center border-blue-600 bg-blue-50 text-blue-600 hover:bg-blue-100"
              onClick={(e) => {
                e.stopPropagation();
                meta?.onStripeSettings?.(company);
              }}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Active</span>
            </Button>
          )}
        </div>
      );
    },
  },
];
