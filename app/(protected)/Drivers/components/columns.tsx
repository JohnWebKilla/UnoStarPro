import { ColumnDef } from "@tanstack/react-table";
import { Driver } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Info, ArrowUpDown } from "lucide-react";
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
          <span className="font-medium">{row.getValue("name")}</span>
          {row.original.company_name && (
            <span className="text-sm text-muted-foreground">
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
        <div className="flex items-center">
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
      return <span>{truckNumber}</span>;
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
      return <span className="capitalize">{type?.toLowerCase()}</span>;
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
      return (
        <Badge
          variant={status?.toLowerCase() === "active" ? "success" : "secondary"}
          className="capitalize"
        >
          {status?.toLowerCase()}
        </Badge>
      );
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
          className="h-8 flex items-center gap-2"
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
      // Check if there's a Stripe connection
      const hasStripeConnection = Boolean(
        row.original.stripe_connect_account_id
      );

      // Check if there's an active subscription amount
      const hasSubscriptionAmount = Boolean(
        (row.original.subscription_amount ?? 0) > 0 ||
          (row.original.subscription?.amount ?? 0) > 0
      );

      const subscription = {
        status:
          hasStripeConnection || hasSubscriptionAmount
            ? "connected"
            : "disconnected",
        amount:
          row.original.subscription?.amount ||
          row.original.subscription_amount ||
          0,
        info: row.original.subscription?.info,
        frequency: row.original.subscription_frequency || "monthly",
      };

      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                subscription.status === "connected" ? "success" : "secondary"
              }
              className="capitalize"
            >
              {subscription.status}
            </Badge>
            {(subscription.info || hasStripeConnection) && (
              <Info className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            ${subscription.amount}/{subscription.frequency}
          </span>
        </div>
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
