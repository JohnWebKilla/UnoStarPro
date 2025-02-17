"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { PayrollTransaction } from "../types";

export const columns: ColumnDef<PayrollTransaction>[] = [
  {
    accessorKey: "transaction_date",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("transaction_date"));
      return date.toLocaleDateString();
    },
  },
  {
    accessorKey: "user",
    header: "Employee",
    cell: ({ row }) => {
      const transaction = row.original;
      return `${transaction.first_name} ${transaction.last_name}`;
    },
  },
  {
    accessorKey: "transaction_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("transaction_type") as string;
      return type.charAt(0).toUpperCase() + type.slice(1);
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number;
      return `$${amount.toFixed(2)}`;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div className="flex items-center">
          <Badge
            variant={
              status === "completed"
                ? "success"
                : status === "pending"
                  ? "warning"
                  : "destructive"
            }
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const transaction = row.original;

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
              onClick={() =>
                navigator.clipboard.writeText(transaction.id.toString())
              }
            >
              Copy transaction ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View details</DropdownMenuItem>
            {transaction.status === "pending" && (
              <>
                <DropdownMenuItem>Mark as completed</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Cancel transaction
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
