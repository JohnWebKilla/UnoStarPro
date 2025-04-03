import { ColumnDef } from "@tanstack/react-table";
import { Driver } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Info,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditDriverDialog } from "./EditDriverDialog";
import { useDrivers } from "./DriversProvider";

function formatCurrency(amount: number) {
  // If amount is already in dollars (less than 1000), treat as dollars
  // If amount is in cents (greater than or equal to 1000), convert to dollars
  const dollars = amount >= 1000 ? amount / 100 : amount;
  return dollars ? `$${dollars.toFixed(2)}` : "$0.00";
}

function getStatusBadge(status: string | undefined | null) {
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
    inactive: {
      variant: "outline",
      label: "Inactive",
      icon: <XCircle className="h-3 w-3" />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    pending: {
      variant: "secondary",
      label: "Pending",
      icon: <Clock className="h-3 w-3" />,
      className:
        "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 border-blue-500/20 dark:border-blue-500/30",
    },
  };

  const config = variants[status.toLowerCase()] || {
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

export const columns: ColumnDef<Driver>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {row.getValue("name")}
          </span>
          {row.original.company_name && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {row.original.company_name}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "phone",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Phone
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const phone = (row.getValue("phone") ||
        row.original.phone_number) as string;
      return (
        <div className="flex items-center text-slate-900 dark:text-slate-100">
          <span>{phone}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "truckNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Truck #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const truckNumber = (row.getValue("truckNumber") ||
        row.original.truck_number) as string;
      return (
        <span className="text-slate-900 dark:text-slate-100">
          {truckNumber}
        </span>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const type = (row.getValue("type") ||
        row.original.solo_or_team) as string;
      return (
        <span className="capitalize text-slate-900 dark:text-slate-100">
          {type?.toLowerCase()}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return getStatusBadge(status);
    },
  },
  {
    accessorKey: "documents",
    header: "Documents",
    cell: ({ row }) => {
      const router = useRouter();
      const documents =
        (row.getValue("documents") as Driver["documents"]) || [];
      const driverLicenses = row.original.driver_licenses || [];
      const medicalCards = row.original.medical_cards || [];
      const mvrFiles = row.original.mvr_files || [];

      const totalDocs = Array.isArray(documents)
        ? documents.length
        : driverLicenses.length + medicalCards.length + mvrFiles.length;

      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 flex items-center gap-2 text-slate-900 dark:text-slate-100"
          onClick={() => router.push(`/Drivers/${row.original.id}/documents`)}
        >
          View
          {totalDocs > 0 && (
            <Badge variant="secondary" className="ml-2">
              {totalDocs}
            </Badge>
          )}
        </Button>
      );
    },
  },
  {
    accessorKey: "stripe_status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Stripe Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // Check if there's a subscription amount to determine if Stripe is connected
      const hasSubscriptionAmount = Boolean(
        (row.original.subscription_amount ?? 0) > 0 ||
          (row.original.subscription?.amount ?? 0) > 0
      );

      return (
        <Badge
          variant={hasSubscriptionAmount ? "success" : "secondary"}
          className={cn(
            "h-6 badge",
            hasSubscriptionAmount
              ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          )}
        >
          {hasSubscriptionAmount ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <XCircle className="h-3 w-3 mr-1" />
          )}
          {hasSubscriptionAmount ? "Connected" : "Disconnected"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "subscription_amount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Monthly Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const amount =
        row.original.subscription?.amount ||
        row.original.subscription_amount ||
        0;
      // Check if the amount is already in dollars
      const displayAmount = amount >= 1000 ? amount / 100 : amount;
      return (
        <span className="text-slate-900 dark:text-slate-100">
          ${displayAmount.toFixed(2)}/mo
        </span>
      );
    },
  },
  {
    accessorKey: "subscription",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Subscription
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // Check if there's a subscription amount to determine if subscription is active
      const hasSubscriptionAmount = Boolean(
        (row.original.subscription_amount ?? 0) > 0 ||
          (row.original.subscription?.amount ?? 0) > 0
      );
      const status = hasSubscriptionAmount ? "active" : "inactive";

      const statusConfig = {
        active: {
          variant: "success" as const,
          icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
          label: "Active",
          className:
            "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
        },
        inactive: {
          variant: "secondary" as const,
          icon: <XCircle className="h-3 w-3 mr-1" />,
          label: "Inactive",
          className:
            "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
        },
        past_due: {
          variant: "destructive" as const,
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
          label: "Past Due",
          className:
            "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
        },
        canceled: {
          variant: "outline" as const,
          icon: <XCircle className="h-3 w-3 mr-1" />,
          label: "Canceled",
          className:
            "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
        },
      };

      const config = statusConfig[status as keyof typeof statusConfig];

      return (
        <Badge
          variant={config.variant}
          className={cn("h-6 badge", config.className)}
        >
          {config.icon}
          {config.label}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const [showEditDialog, setShowEditDialog] = useState(false);
      const driver = row.original;
      const { refreshDrivers } = useDrivers();

      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                data-dropdown-menu
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  // Handle delete
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EditDriverDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            driver={driver}
            onDriverUpdated={refreshDrivers}
          />
        </div>
      );
    },
  },
];
