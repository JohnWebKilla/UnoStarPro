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

interface SystemIssue {
  id: string;
  timestamp: Date;
  company: string;
  driver: string;
  systemType: "android" | "ios" | "web";
  description: string;
  status: "open" | "in progress" | "resolved";
  solution?: string;
  resolvedAt?: Date;
  files: {
    name: string;
    url: string;
    type: string;
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

// Export the mock data
export const mockIssues: SystemIssue[] = [
  {
    id: "1",
    timestamp: new Date("2024-02-11T14:30:00"),
    company: "TR LINES INC",
    driver: "Azim Kosimov",
    systemType: "android",
    description: "App crashes when trying to upload delivery photos",
    status: "open",
    files: [
      {
        name: "crash_log.txt",
        url: "/path/to/crash_log.txt",
        type: "text/plain",
      },
      {
        name: "screenshot.png",
        url: "/path/to/screenshot.png",
        type: "image/png",
      },
    ],
  },
  {
    id: "2",
    timestamp: new Date("2024-02-11T15:15:00"),
    company: "LION CARGO",
    driver: "Irakli Rizhamadze",
    systemType: "ios",
    description: "GPS tracking not updating in real-time",
    status: "in progress",
    files: [
      {
        name: "debug_log.txt",
        url: "/path/to/debug_log.txt",
        type: "text/plain",
      },
    ],
  },
  {
    id: "3",
    timestamp: new Date("2024-02-11T16:00:00"),
    company: "US ROAD",
    driver: "Kakha Aladashvili",
    systemType: "web",
    description: "Unable to submit delivery confirmation form",
    status: "resolved",
    solution:
      "Fixed CORS issue on the server and updated API endpoint validation",
    resolvedAt: new Date("2024-02-11T18:30:00"),
    files: [],
  },
  {
    id: "4",
    timestamp: new Date("2024-02-11T16:45:00"),
    company: "SWIFT LOGISTICS",
    driver: "David Chen",
    systemType: "android",
    description: "Push notifications not working for new assignments",
    status: "in progress",
    files: [
      {
        name: "notification_log.txt",
        url: "/path/to/notification_log.txt",
        type: "text/plain",
      },
    ],
  },
  {
    id: "5",
    timestamp: new Date("2024-02-11T17:30:00"),
    company: "CARGO PLUS",
    driver: "Chris Davis",
    systemType: "ios",
    description: "App freezes when scanning multiple barcodes",
    status: "open",
    files: [
      {
        name: "freeze_screenshot.png",
        url: "/path/to/freeze_screenshot.png",
        type: "image/png",
      },
    ],
  },
  {
    id: "6",
    timestamp: new Date("2024-02-11T18:15:00"),
    company: "FAST TRACK",
    driver: "Tom Wilson",
    systemType: "web",
    description: "Document upload failing with large PDF files",
    status: "resolved",
    solution:
      "Increased file size limit and implemented chunked upload for large files",
    resolvedAt: new Date("2024-02-11T20:45:00"),
    files: [
      {
        name: "error_report.pdf",
        url: "/path/to/error_report.pdf",
        type: "application/pdf",
      },
    ],
  },
  {
    id: "7",
    timestamp: new Date("2024-02-11T19:00:00"),
    company: "ROAD KINGS",
    driver: "John Smith",
    systemType: "android",
    description: "Battery drain issue with location tracking",
    status: "in progress",
    files: [
      {
        name: "battery_stats.txt",
        url: "/path/to/battery_stats.txt",
        type: "text/plain",
      },
    ],
  },
];

export function IssuesTable({ issues }: IssuesTableProps) {
  return <DataTable columns={columns} data={issues as any} type="issues" />;
}
