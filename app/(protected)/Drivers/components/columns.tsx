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
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";

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
          className="p-0 hover:bg-transparent text-slate-700 dark:text-slate-300 font-medium"
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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
          className="p-0 hover:bg-transparent text-slate-700 dark:text-slate-300 font-medium"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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
          className="p-0 hover:bg-transparent text-slate-700 dark:text-slate-300 font-medium"
        >
          Phone
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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
          className="p-0 hover:bg-transparent text-slate-700 dark:text-slate-300 font-medium"
        >
          Truck #
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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
          className="p-0 hover:bg-transparent text-slate-700 dark:text-slate-300 font-medium"
        >
          Type
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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
    header: () => (
      <span className="text-slate-700 dark:text-slate-300 font-medium">
        Stripe
      </span>
    ),
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
      const [showTooltip, setShowTooltip] = useState(false);
      const [tooltipPosition, setTooltipPosition] = useState({
        top: 0,
        left: 0,
        rowPosition: "top",
      });
      const docContainerRef = useRef<HTMLDivElement>(null);

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

      // Update tooltip position when hovering over the badge
      useEffect(() => {
        const updateTooltipPosition = () => {
          if (docContainerRef.current) {
            const rect = docContainerRef.current.getBoundingClientRect();

            setTooltipPosition({
              top: rect.top,
              left: rect.left + rect.width / 2,
              rowPosition: rect.top < window.innerHeight / 2 ? "top" : "bottom",
            });
          }
        };

        if (showTooltip) {
          updateTooltipPosition();
          // Add window resize listener to update position
          window.addEventListener("resize", updateTooltipPosition);
          window.addEventListener("scroll", updateTooltipPosition, true);
        }

        return () => {
          window.removeEventListener("resize", updateTooltipPosition);
          window.removeEventListener("scroll", updateTooltipPosition, true);
        };
      }, [showTooltip]);

      // Tooltip component that will be rendered via portal
      const TooltipContent = () => {
        if (!showTooltip || !docContainerRef.current) return null;

        const badgeRect = docContainerRef.current.getBoundingClientRect();

        // Set fixed distance from badge to tooltip
        const spacing = 15;

        return createPortal(
          <div
            style={{
              position: "fixed",
              top: badgeRect.top - spacing, // Position tooltip directly above the badge
              left: badgeRect.left + badgeRect.width / 2,
              transform: "translate(-50%, -100%)", // Center horizontally and position above
              zIndex: 99999,
            }}
            className="document-tooltip-portal"
          >
            <div className="document-summary-card">
              <div className="document-summary-header">Document Summary</div>
              <div className="document-summary-body">
                <div className="document-summary-total">
                  <span>Total:</span>
                  <span>{docStats.total} documents</span>
                </div>

                {docStats.expired > 0 && (
                  <div className="document-summary-alert">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">
                      {docStats.expired} expired
                    </span>
                  </div>
                )}

                {docStats.expiringSoon > 0 && (
                  <div className="document-summary-alert">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-500">
                      {docStats.expiringSoon} expiring soon
                    </span>
                  </div>
                )}

                {/* Document category breakdown */}
                {docCategories
                  .filter(
                    (category) => docStats.byCategory[category.name].total > 0
                  )
                  .map((category) => (
                    <div
                      key={category.name}
                      className="document-summary-category"
                    >
                      <span className="document-category-icon">
                        {category.icon}
                      </span>
                      <span className="document-category-name">
                        {category.name}:
                      </span>
                      <span className="document-category-count">
                        {docStats.byCategory[category.name].total}
                      </span>

                      {/* Warning icon if needed */}
                      {docStats.byCategory[category.name].expired > 0 && (
                        <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                      )}
                      {docStats.byCategory[category.name].expired === 0 &&
                        docStats.byCategory[category.name].expiringSoon > 0 && (
                          <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />
                        )}
                    </div>
                  ))}

                <div className="document-summary-footer">
                  Click to view all documents
                </div>
              </div>
              {/* Add a visible arrow pointing to the badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: "-15px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "0",
                  height: "0",
                  borderLeft: "15px solid transparent",
                  borderRight: "15px solid transparent",
                  borderTop: "15px solid white",
                }}
                className="tooltip-arrow"
              />
            </div>
          </div>,
          document.body
        );
      };

      return (
        <div
          ref={docContainerRef}
          className="relative document-container"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            className="flex items-center justify-center cursor-pointer document-cell w-full h-full"
            onClick={goToDocumentsTab}
          >
            <div className="document-badge">
              <span className="font-medium text-center">{docStats.total}</span>
              {(docStats.expired > 0 || docStats.expiringSoon > 0) && (
                <span className="ml-2">
                  {docStats.expired > 0 ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : docStats.expiringSoon > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : null}
                </span>
              )}
            </div>
          </div>

          {/* Render the tooltip via portal */}
          <TooltipContent />
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
