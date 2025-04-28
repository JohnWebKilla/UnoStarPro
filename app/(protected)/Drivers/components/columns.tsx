"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Driver } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  differenceInDays,
  formatDistanceToNow,
  format,
  isBefore,
  addDays,
  parseISO,
} from "date-fns";

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

// Create a row click handler to navigate to driver details
const useDriverRowClick = () => {
  const router = useRouter();

  return (driverId: string | number) => {
    if (driverId) {
      router.push(`/Drivers/${driverId}`);
    }
  };
};

export const columns: ColumnDef<Driver>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      const daysDiff = differenceInDays(new Date(), date);

      return (
        <span className="text-slate-900 dark:text-slate-100">
          {daysDiff <= 7
            ? formatDistanceToNow(date, { addSuffix: true })
            : format(date, "MMM d, yyyy")}
        </span>
      );
    },
  },
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

      const today = new Date();

      // Function to check if a document is expired or expiring soon
      const checkDocumentStatus = (doc: any) => {
        if (!doc.expiration_date && !doc.expiryDate) return null;

        const expiryDate = parseISO(doc.expiration_date || doc.expiryDate);

        if (isBefore(expiryDate, today)) {
          return "expired";
        } else if (isBefore(expiryDate, addDays(today, 30))) {
          return "expiring-soon";
        }
        return "valid";
      };

      // Check all document types
      const allDocs = [
        ...documents,
        ...driverLicenses,
        ...medicalCards,
        ...mvrFiles,
      ];

      const expiredCount = allDocs.filter(
        (doc) => checkDocumentStatus(doc) === "expired"
      ).length;
      const expiringSoonCount = allDocs.filter(
        (doc) => checkDocumentStatus(doc) === "expiring-soon"
      ).length;
      const validCount = allDocs.length - expiredCount - expiringSoonCount;
      const totalDocs = allDocs.length;

      // Navigate to documents tab
      const goToDocumentsTab = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click from triggering
        router.push(`/Drivers/${row.original.id}?tab=documents`);
      };

      return (
        <div className="relative group">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 flex items-center gap-2 text-slate-900 dark:text-slate-100 px-3"
            onClick={goToDocumentsTab}
          >
            <div className="flex items-center">
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full",
                  (expiredCount > 0 || expiringSoonCount > 0) && "mr-1"
                )}
              >
                {totalDocs}
              </Badge>

              {(expiredCount > 0 || expiringSoonCount > 0) && (
                <div className="flex -space-x-1">
                  {expiredCount > 0 && (
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 border border-white dark:border-gray-800 z-10"></div>
                  )}

                  {expiringSoonCount > 0 && (
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-white dark:border-gray-800"></div>
                  )}
                </div>
              )}
            </div>
          </Button>

          {/* Tooltip that appears on hover */}
          {(expiredCount > 0 || expiringSoonCount > 0) && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-slate-800 dark:bg-slate-900 text-white text-xs rounded py-1 px-2 shadow-lg">
                {expiredCount > 0 && (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    <span>{expiredCount} expired</span>
                  </div>
                )}
                {expiringSoonCount > 0 && (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span>{expiringSoonCount} expiring soon</span>
                  </div>
                )}
              </div>
              <div className="arrow-down"></div>
            </div>
          )}
        </div>
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
];

// Add clickable row functionality
export const enhanceColumnsWithRowClick = (columns: ColumnDef<Driver>[]) => {
  const handleDriverRowClick = useDriverRowClick();

  return {
    columns,
    meta: {
      onRowClick: (row: any) => {
        // Get the driver ID from the row object
        const driverId = row?.original?.id;
        if (driverId) {
          handleDriverRowClick(driverId);
        } else {
          console.warn("Row clicked but no driver ID found", row);
        }
      },
    },
  };
};
