"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const columns: ColumnDef<any, any>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp");
      if (
        timestamp instanceof Date ||
        typeof timestamp === "string" ||
        typeof timestamp === "number"
      ) {
        const date = new Date(timestamp);
        return (
          <div className="flex flex-col">
            <span>{format(date, "M/d/yyyy")}</span>
            <span className="text-muted-foreground text-sm">
              {format(date, "h:mm a")}
            </span>
          </div>
        );
      }
      return null;
    },
  },
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => {
      const company = row.getValue("company");
      return <div>{String(company)}</div>;
    },
  },
  {
    accessorKey: "driver",
    header: "Driver",
    cell: ({ row }) => {
      const driver = row.getValue("driver");
      return <div>{String(driver)}</div>;
    },
  },
  {
    accessorKey: "services",
    header: () => <div className="flex items-center">Services</div>,
    cell: ({ row }) => {
      const service = row.getValue("services");
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {String(service)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "dispatcher",
    header: "Dispatcher",
    cell: ({ row }) => {
      const dispatcher = String(row.getValue("dispatcher"));
      return (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">
            {dispatcher.charAt(0)}
          </div>
          <span>{dispatcher}</span>
        </div>
      );
    },
  },

  {
    accessorKey: "editor",
    header: "Editor",
    cell: ({ row }) => {
      const editor = String(row.getValue("editor"));
      return (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">
            {editor.charAt(0)}
          </div>
          <span>{editor}</span>
        </div>
      );
    },
  },

  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      const duration = row.getValue("duration");
      return <div>{String(duration)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = String(row.getValue("status"));
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {status}
          </Badge>
          <Button variant="ghost" size="icon" className="h-4 w-4">
            <Info className="h-3 w-3" />
          </Button>
        </div>
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
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
