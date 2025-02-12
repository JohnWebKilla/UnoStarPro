"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SystemIssue } from "../types";

interface SystemIssue {
  id: string;
  timestamp: Date;
  company: string;
  driver: string;
  systemType: "android" | "ios" | "web";
  description: string;
  status: "open" | "in progress" | "resolved";
  files: {
    name: string;
    url: string;
  }[];
}

interface IssuesTableProps {
  issues: SystemIssue[];
}

const columns: ColumnDef<SystemIssue>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as Date;
      return (
        <div className="flex flex-col">
          <span>{timestamp.toLocaleDateString()}</span>
          <span className="text-muted-foreground text-sm">
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "company",
    header: "Company",
  },
  {
    accessorKey: "driver",
    header: "Driver",
  },
  {
    accessorKey: "systemType",
    header: "System",
    cell: ({ row }) => {
      const type = row.getValue("systemType") as string;
      return (
        <Badge variant="secondary" className="capitalize">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
      return <div className="max-w-[300px] truncate">{description}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant="secondary"
          className={
            status === "open"
              ? "bg-red-100 text-red-800"
              : status === "in progress"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
          }
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "files",
    header: "Files",
    cell: ({ row }) => {
      const files = row.getValue("files") as { name: string; url: string }[];
      return files?.length ? (
        <div className="flex items-center gap-1">
          <Paperclip className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">
            {files.length} file(s)
          </span>
        </div>
      ) : null;
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
            <DropdownMenuItem>Update Status</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function IssuesTable({ issues }: IssuesTableProps) {
  return <DataTable columns={columns} data={issues} />;
}
