import { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }: any) => {
      const timestamp = row.getValue("timestamp");
      if (!timestamp) {
        return "N/A";
      }

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      return formatDistanceToNow(date, {
        addSuffix: true,
      });
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
    accessorKey: "driverNote",
    header: "Driver Note",
  },
  {
    accessorKey: "services",
    header: "Services",
    cell: ({ row }: any) => {
      const services = row.getValue("services");
      if (!Array.isArray(services)) {
        return "N/A";
      }
      return (
        <div className="flex flex-wrap gap-1">
          {services.map((service, i) => (
            <Badge key={i} variant="secondary">
              {service}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "dispatcher",
    header: "Dispatcher",
  },
  {
    accessorKey: "dispatchNote",
    header: "Dispatch Note",
  },
  {
    accessorKey: "editor",
    header: "Editor",
  },
  {
    accessorKey: "editorNote",
    header: "Editor Note",
  },
  {
    accessorKey: "duration",
    header: "Duration",
  },
  {
    accessorKey: "files",
    header: "Files",
    cell: ({ row }: any) => {
      const files = row.getValue("files") as string[];
      return files?.length > 0 ? (
        <Button variant="ghost" size="sm">
          <FileText className="h-4 w-4" />
          <span className="ml-2">{files.length}</span>
        </Button>
      ) : null;
    },
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }: any) => {
      const rating = row.getValue("rating") as number;
      return "⭐".repeat(rating);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: any) => {
      const status = row.getValue("status") as string;
      return <Badge>{status}</Badge>;
    },
  },
  {
    accessorKey: "contactPerson",
    header: "Contact Person",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "actives",
    header: "Actives",
  },
  {
    accessorKey: "inactives",
    header: "Inactives",
  },
  {
    accessorKey: "inReviews",
    header: "In Reviews",
  },
  {
    accessorKey: "subscription",
    header: "Subscription",
  },
  {
    id: "actions",
    cell: ({ row }: any) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>View Details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
