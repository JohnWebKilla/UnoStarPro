"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Check,
  X,
  Cake,
  Bell,
  Building,
  Pencil,
  Power,
  UserCog,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateUserStatus } from "../lib/actions/actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { User, Company } from "../lib/types/types";

const variantMap = {
  active: "default",
  pending: "outline",
  inactive: "destructive",
} as const;

// Add helper function to check birthday
export const getBirthdayStatus = (dob: string) => {
  if (!dob) return null;

  const today = new Date();
  const birthday = new Date(dob);

  // Compare just month and day
  const isToday =
    today.getMonth() === birthday.getMonth() &&
    today.getDate() === birthday.getDate();

  if (isToday) return "today";

  // Calculate next birthday
  const nextBirthday = new Date(
    today.getFullYear(),
    birthday.getMonth(),
    birthday.getDate()
  );

  // If birthday has passed this year, get next year's birthday
  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const diffTime = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) return "upcoming";
  return null;
};

// Update the TableMeta interface to use the User type
interface TableMeta {
  onEdit: (user: User) => void;
  onToggleStatus: (user: User) => Promise<void>;
  onApprove: (user: User) => Promise<void>;
  onManageCompanies: (user: User) => void;
  companies: Company[]; // Add companies to meta
}

// Update the columns type to use User
export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "avatar",
    header: "",
    cell: ({ row }) => {
      const avatar = row.getValue("avatar") as string;
      const name = `${row.getValue("first_name")} ${row.getValue("last_name")}`;

      return (
        <Avatar>
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
      );
    },
  },
  {
    accessorKey: "first_name",
    header: "First Name",
  },
  {
    accessorKey: "last_name",
    header: "Last Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone_number",
    header: "Phone",
  },
  {
    accessorKey: "role",
    header: "Role",
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => {
      const department = row.getValue("department") as string | undefined;
      if (!department) return "-";

      // Map of department icons
      const departmentIcons: Record<string, string> = {
        Editor: "✏️",
        Manager: "👔",
        Dispatcher: "📡",
        Safety: "🛡️",
      };

      return (
        <div className="flex items-center gap-2">
          <span>{departmentIcons[department] || ""}</span>
          <span>{department}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "working_shift",
    header: "Working Shift",
    cell: ({ row }) => {
      const shiftId = row.getValue("working_shift") as string;

      switch (shiftId) {
        case "1":
          return (
            <div className="flex flex-col gap-1">
              <Badge
                variant="outline"
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                <span className="mr-1">🌅</span>
                Morning Shift
              </Badge>
              <span className="text-sm text-muted-foreground">
                06:00 - 14:00
              </span>
            </div>
          );
        case "2":
          return (
            <div className="flex flex-col gap-1">
              <Badge
                variant="outline"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
              >
                <span className="mr-1">🌞</span>
                Afternoon Shift
              </Badge>
              <span className="text-sm text-muted-foreground">
                14:00 - 22:00
              </span>
            </div>
          );
        case "3":
          return (
            <div className="flex flex-col gap-1">
              <Badge
                variant="outline"
                className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
              >
                <span className="mr-1">🌙</span>
                Night Shift
              </Badge>
              <span className="text-sm text-muted-foreground">
                22:00 - 06:00
              </span>
            </div>
          );
        default:
          return shiftId || "-";
      }
    },
  },
  {
    accessorKey: "off_days",
    header: "Off Days",
    cell: ({ row }) => {
      const offDays = row.getValue("off_days") as string[];

      if (!offDays || !Array.isArray(offDays) || offDays.length === 0) {
        return "-";
      }

      // Capitalize first letter of each day
      const formattedDays = offDays
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(", ");

      return formattedDays;
    },
  },
  {
    accessorKey: "dob",
    header: "Date of Birth",
    cell: ({ row }) => {
      const dob = row.getValue("dob") as string;
      const birthdayStatus = getBirthdayStatus(dob);

      if (!dob) return "-";

      return (
        <div className="flex items-center gap-2">
          <span>{new Date(dob).toLocaleDateString()}</span>
          {birthdayStatus === "today" && (
            <Tooltip>
              <TooltipTrigger>
                <Cake className="h-4 w-4 text-pink-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Birthday Today! 🎉</p>
              </TooltipContent>
            </Tooltip>
          )}
          {birthdayStatus === "upcoming" && (
            <Tooltip>
              <TooltipTrigger>
                <Bell className="h-4 w-4 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Birthday Coming Up! 🎈</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={variantMap[status as keyof typeof variantMap] || "default"}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "companies",
    header: "Companies",
    cell: ({ row, table }) => {
      const user = row.original;
      const meta = table.options.meta as TableMeta;

      const CompanyCell = () => {
        const getCompanyText = () => {
          if (user.has_all_access) return "All Companies";
          if (user.companies && user.companies.length > 0) {
            if (user.companies.length === 1) {
              return user.companies[0].name;
            }
            return `${user.companies.length} Companies`;
          }
          return "No Company Assigned";
        };

        return (
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={() => meta.onManageCompanies(user)}
          >
            <span className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              {getCompanyText()}
            </span>
          </Button>
        );
      };

      return <CompanyCell />;
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const meta = table.options.meta as TableMeta;
      const user = row.original;

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
            <DropdownMenuItem onClick={() => meta.onEdit(user)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta.onManageCompanies(user)}>
              <Building className="mr-2 h-4 w-4" />
              Manage Companies
            </DropdownMenuItem>
            {user.status === "pending" && (
              <DropdownMenuItem onClick={() => meta.onApprove(user)}>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => meta.onToggleStatus(user)}>
              <Power className="mr-2 h-4 w-4" />
              {user.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
