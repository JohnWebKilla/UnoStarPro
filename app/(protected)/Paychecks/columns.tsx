"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye } from "lucide-react";
import { PayrollTransaction } from "./types/index";

export const columns: ColumnDef<PayrollTransaction>[] = [
  {
    accessorKey: "transaction_date",
    header: "Date",
    cell: ({ row }) => {
      return new Date(row.getValue("transaction_date")).toLocaleDateString();
    },
  },
  {
    accessorKey: "user",
    header: "Employee",
    cell: ({ row }) => {
      const user = row.original.user;
      return (
        <div>
          <p className="font-medium">{`${user.first_name} ${user.last_name}`}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "transaction_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("transaction_type") as string;
      return (
        <Badge
          variant={
            type === "payment"
              ? "success"
              : type === "advance"
                ? "warning"
                : type === "penalty"
                  ? "destructive"
                  : "default"
          }
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number;
      return <span className="font-medium">${amount.toFixed(2)}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={
            status === "pending"
              ? "warning"
              : status === "completed"
                ? "success"
                : "destructive"
          }
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
