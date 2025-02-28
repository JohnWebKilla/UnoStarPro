"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MonthlyPayrollSummary } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, CalendarClock, Building } from "lucide-react";
import { getOverallStatus, getStatusBadgeClass } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const columns: ColumnDef<MonthlyPayrollSummary>[] = [
  {
    accessorKey: "employee",
    header: "Employee",
    cell: ({ row }) => {
      const data = row.original;
      return (
        <div>
          <div className="font-medium">
            {data.first_name} {data.last_name}
          </div>
          <div className="text-sm text-muted-foreground">{data.email}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => {
      const department = row.original.department;
      return department ? (
        <div className="flex items-center">
          <Building className="h-4 w-4 mr-2 text-muted-foreground" />
          <span>{department}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "schedule",
    header: "Shift",
    cell: ({ row }) => {
      const schedule = row.original.schedule;
      return schedule ? (
        <div className="flex items-center">
          <CalendarClock className="h-4 w-4 mr-2 text-muted-foreground" />
          <span>
            {schedule.shift_name || `Shift ${schedule.working_shift}`}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "base_payment",
    header: "Base Payment",
    cell: ({ row }) => {
      const amount = row.getValue("base_payment") as number;
      return <div className="font-medium">${amount.toFixed(2)}</div>;
    },
  },
  {
    accessorKey: "advances",
    header: "Advances",
    cell: ({ row }) => {
      const amount = row.getValue("advances") as number;
      return amount > 0 ? (
        <div className="text-yellow-600">${amount.toFixed(2)}</div>
      ) : null;
    },
  },
  {
    accessorKey: "penalties",
    header: "Penalties",
    cell: ({ row }) => {
      const amount = row.getValue("penalties") as number;
      return amount > 0 ? (
        <div className="text-red-600">${amount.toFixed(2)}</div>
      ) : null;
    },
  },
  {
    accessorKey: "bonuses",
    header: "Bonuses",
    cell: ({ row }) => {
      const amount = row.getValue("bonuses") as number;
      return amount > 0 ? (
        <div className="text-green-600">${amount.toFixed(2)}</div>
      ) : null;
    },
  },
  {
    accessorKey: "total_amount",
    header: "Total",
    cell: ({ row }) => {
      const data = row.original;
      return <div className="font-bold">${data.total_amount.toFixed(2)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const data = row.original;
      const status = getOverallStatus(data);
      return (
        <Badge
          variant={
            status === "paid"
              ? "success"
              : status === "partially_paid"
                ? "default"
                : status === "pending"
                  ? "warning"
                  : "destructive"
          }
        >
          {status === "partially_paid"
            ? "Partially Paid"
            : status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "paid_amount",
    header: "Paid Amount",
    cell: ({ row }) => {
      const data = row.original;
      // Ensure paid amount doesn't exceed total amount
      const paidAmount = Math.min(data.paid_amount, data.total_amount);
      return (
        <div className="space-y-1">
          <div className="font-medium">${paidAmount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">
            of ${data.total_amount.toFixed(2)}
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const data = row.original;
      const meta = table.options.meta as {
        onViewTransactions?: (userId: string) => void;
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => meta.onViewTransactions?.(data.user_id)}
              disabled={!meta.onViewTransactions}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Transactions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
