import { ColumnDef } from "@tanstack/react-table";
import { User } from "../../lib/types/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Shield,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// Define the meta type for the table
interface TableMeta {
  onEdit: (user: User) => void;
  onManageCompanies: (user: User) => void;
  onToggleStatus: (user: User) => void;
  companies?: any[];
}

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

function getRoleBadge(role: string | undefined | null) {
  if (!role) return null;

  const variants: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline" | "success";
      label: string;
      icon: React.ReactNode;
      className?: string;
    }
  > = {
    admin: {
      variant: "success",
      label: "Admin",
      icon: <Shield className="h-3 w-3" />,
      className:
        "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 hover:bg-violet-500/20 dark:hover:bg-violet-500/30 border-violet-500/20 dark:border-violet-500/30",
    },
    user: {
      variant: "outline",
      label: "User",
      icon: null,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
  };

  const config = variants[role.toLowerCase()] || {
    variant: "outline",
    label: role,
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

export const columns: ColumnDef<User, any>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "name",
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
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
      const firstName = row.original.first_name;
      const lastName = row.original.last_name;
      const fullName = `${firstName} ${lastName}`;

      return (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {fullName}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex items-center">
          <Mail className="h-4 w-4 mr-2 text-slate-500" />
          <span className="text-slate-900 dark:text-slate-100">
            {row.getValue("email")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "phone_number",
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
    cell: ({ row }) => row.getValue("phone_number") || "-",
  },
  {
    accessorKey: "role",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => getRoleBadge(row.getValue("role")),
  },
  {
    accessorKey: "department",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Department
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => row.getValue("department") || "-",
  },
  {
    accessorKey: "working_shift",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Working Shift
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => row.getValue("working_shift") || "-",
  },
  {
    accessorKey: "off_days",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Off Days
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const offDays = row.getValue("off_days");
      if (!offDays || !Array.isArray(offDays) || offDays.length === 0)
        return "-";
      return offDays
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(", ");
    },
  },
  {
    accessorKey: "dob",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Date of Birth
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const dob = row.getValue("dob");
      if (!dob) return "-";
      return new Date(dob as string).toLocaleDateString();
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
    cell: ({ row }) => getStatusBadge(row.getValue("status")),
  },
  {
    id: "companies",
    header: "Companies",
    cell: ({ row }) => {
      const companies = row.original.companies;
      if (!companies || companies.length === 0) {
        return (
          <div className="flex items-center text-blue-600 dark:text-blue-400">
            No Company Assigned
          </div>
        );
      }
      return (
        <div className="flex items-center text-blue-600 dark:text-blue-400">
          All Companies
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const user = row.original;
      const meta = table.options.meta as TableMeta;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => meta?.onEdit(user)}>
              Edit user
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onManageCompanies(user)}>
              Manage companies
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onToggleStatus(user)}>
              {user.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
