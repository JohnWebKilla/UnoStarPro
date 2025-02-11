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

interface Ticket {
  timestamp: Date;
  company: string;
  driver: string;
  services: string;
  dispatcher: string;
  editor: string;
  duration: string;
  status: string;
  dispatchNote?: string;
  editorNote?: string;
}

const getDurationColor = (duration: string) => {
  const minutes = parseInt(duration.replace("m", ""));
  if (minutes <= 10) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  } else if (minutes <= 20) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  } else {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  }
};

export const columns: ColumnDef<Ticket, any>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as Date;
      return (
        <div className="flex flex-col">
          <span>{format(timestamp, "M/d/yyyy")}</span>
          <span className="text-muted-foreground text-sm">
            {format(timestamp, "h:mm a")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => {
      return <div>{row.getValue("company") as string}</div>;
    },
  },
  {
    accessorKey: "driver",
    header: "Driver",
    cell: ({ row }) => {
      return <div>{row.getValue("driver") as string}</div>;
    },
  },
  {
    accessorKey: "services",
    header: () => <div className="flex items-center">Services ↑↓</div>,
    cell: ({ row }) => {
      const service = row.getValue("services") as string;
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {service}
        </Badge>
      );
    },
  },
  {
    accessorKey: "dispatcher",
    header: "Dispatcher",
    cell: ({ row }) => {
      const dispatcher = row.getValue("dispatcher") as string;
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
      const editor = row.getValue("editor") as string;
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
      const duration = row.getValue("duration") as string;
      return (
        <Badge variant="secondary" className={cn(getDurationColor(duration))}>
          {duration}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
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
