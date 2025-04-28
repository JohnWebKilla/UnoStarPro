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
  CreditCard,
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

// Import the SyncDriverButton component
import { SyncDriverButton } from "./SyncDriverButton";

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
    id: "stripe",
    header: "Stripe",
    cell: ({ row }) => {
      const driver = row.original;
      const hasStripeProduct = !!driver.stripe_product_id;
      const hasStripePrice = !!driver.stripe_price_id;
      const subscriptionAmount =
        driver.subscription_amount || driver.price_amount;

      return (
        <div className="flex items-center gap-2">
          {hasStripeProduct ? (
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
            >
              <CreditCard className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">
              <XCircle className="mr-1 h-3 w-3" />
              Not Connected
            </Badge>
          )}

          {subscriptionAmount && (
            <span className="text-sm font-medium">
              ${subscriptionAmount}/mo
            </span>
          )}

          <SyncDriverButton driver={driver} size="icon" />
        </div>
      );
    },
  },
  {
    accessorKey: "documents",
    header: "Documents",
    cell: ({ row }) => {
      const router = useRouter();

      // Get all document types
      const documents =
        (row.getValue("documents") as Driver["documents"]) || [];
      const driverLicenses = row.original.driver_licenses || [];
      const medicalCards = row.original.medical_cards || [];
      const mvrFiles = row.original.mvr_files || [];

      const today = new Date();

      // Function to check if a document is expired or expiring soon
      const checkDocumentStatus = (doc: any) => {
        if (!doc.expiration_date && !doc.expiryDate) return "no-expiry";

        const expiryDate = parseISO(doc.expiration_date || doc.expiryDate);

        if (isBefore(expiryDate, today)) {
          return "expired";
        } else if (isBefore(expiryDate, addDays(today, 30))) {
          return "expiring-soon";
        }
        return "valid";
      };

      // Categorize documents by type and status
      const docCategories = [
        { name: "General", docs: documents, icon: "📄" },
        { name: "Driver License", docs: driverLicenses, icon: "🪪" },
        { name: "Medical Card", docs: medicalCards, icon: "🏥" },
        { name: "MVR", docs: mvrFiles, icon: "🚗" },
      ];

      // Count documents by status
      const docStats = {
        expired: 0,
        expiringSoon: 0,
        valid: 0,
        noExpiry: 0,
        total: 0,
        byCategory: {} as Record<
          string,
          {
            expired: number;
            expiringSoon: number;
            valid: number;
            noExpiry: number;
            total: number;
          }
        >,
      };

      // Process all documents and build statistics
      docCategories.forEach((category) => {
        docStats.byCategory[category.name] = {
          expired: 0,
          expiringSoon: 0,
          valid: 0,
          noExpiry: 0,
          total: 0,
        };

        category.docs.forEach((doc) => {
          const status = checkDocumentStatus(doc);
          docStats.total++;
          docStats.byCategory[category.name].total++;

          if (status === "expired") {
            docStats.expired++;
            docStats.byCategory[category.name].expired++;
          } else if (status === "expiring-soon") {
            docStats.expiringSoon++;
            docStats.byCategory[category.name].expiringSoon++;
          } else if (status === "valid") {
            docStats.valid++;
            docStats.byCategory[category.name].valid++;
          } else {
            docStats.noExpiry++;
            docStats.byCategory[category.name].noExpiry++;
          }
        });
      });

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
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {docStats.total}
              </Badge>

              {/* Status indicators - restored */}
              {(docStats.expired > 0 || docStats.expiringSoon > 0) && (
                <div className="flex space-x-1">
                  {docStats.expired > 0 && (
                    <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  )}
                  {docStats.expiringSoon > 0 && docStats.expired === 0 && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  )}
                </div>
              )}
            </div>
          </Button>

          {/* Enhanced tooltip with document breakdown */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
            <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs rounded-md py-2 px-3 shadow-lg border border-slate-200 dark:border-slate-700 min-w-[200px]">
              <div className="font-medium border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                Document Summary
              </div>

              {/* Overall status */}
              <div className="flex justify-between mb-2">
                <span>Total:</span>
                <span className="font-medium">{docStats.total} documents</span>
              </div>

              {docStats.expired > 0 && (
                <div className="flex items-center gap-1 whitespace-nowrap text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>{docStats.expired} expired</span>
                </div>
              )}

              {docStats.expiringSoon > 0 && (
                <div className="flex items-center gap-1 whitespace-nowrap text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{docStats.expiringSoon} expiring soon</span>
                </div>
              )}

              {/* Document breakdown by category */}
              {docStats.total > 0 && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-700 my-1 pt-1">
                    {docCategories.map(
                      (category) =>
                        docStats.byCategory[category.name].total > 0 && (
                          <div key={category.name} className="mt-1">
                            <div className="flex items-center gap-1">
                              <span>{category.icon}</span>
                              <span className="font-medium">
                                {category.name}:
                              </span>
                              <span>
                                {docStats.byCategory[category.name].total}
                              </span>

                              {/* Show warning icons if needed */}
                              {docStats.byCategory[category.name].expired >
                                0 && (
                                <AlertCircle className="h-3 w-3 text-red-500 ml-auto" />
                              )}
                              {docStats.byCategory[category.name].expired ===
                                0 &&
                                docStats.byCategory[category.name]
                                  .expiringSoon > 0 && (
                                  <AlertTriangle className="h-3 w-3 text-amber-500 ml-auto" />
                                )}
                            </div>
                          </div>
                        )
                    )}
                  </div>
                </>
              )}

              {/* Click instruction */}
              <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                Click to view all documents
              </div>
            </div>
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white dark:border-t-slate-800"></div>
          </div>
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
