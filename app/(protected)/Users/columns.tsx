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
import { updateUserStatus } from "./actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { User, UserRole } from "./types";
import { useState } from "react";

interface Company {
  id: number;
  name: string;
  status: string;
}

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
      const shift = row.getValue("working_shift") as string;

      // Map of shift names
      const shiftNames: Record<string, string> = {
        "1": "Shift 1 (08:00 - 16:00)",
        "2": "Shift 2 (16:00 - 00:00)",
        "3": "Shift 3 (00:00 - 08:00)",
      };

      return shiftNames[shift] || shift || "-";
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
                <Bell className="h-4 w-4 text-yellow-500 animate-pulse" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Upcoming Birthday! 🎈</p>
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
        <Badge variant={variantMap[status as keyof typeof variantMap]}>
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
        const [isOpen, setIsOpen] = useState(false);

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
      const user = row.original;
      const meta = table.options.meta as TableMeta;
      const [open, setOpen] = useState(false);

      const handleAction = (action: () => void) => {
        setOpen(false); // Close dropdown before executing action
        action();
      };

      return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => handleAction(() => meta.onEdit(user))}
              className="flex items-center gap-2"
            >
              <UserCog className="h-4 w-4" />
              <span>Edit User</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleAction(() => meta.onManageCompanies(user))}
              className="flex items-center gap-2"
            >
              <Building className="h-4 w-4" />
              <span>Manage Company Access</span>
            </DropdownMenuItem>
            {user.status === "active" && (
              <DropdownMenuItem
                onSelect={() =>
                  handleAction(async () => {
                    try {
                      await meta.onToggleStatus(user);
                    } catch (error) {
                      console.error("Error deactivating user:", error);
                    }
                  })
                }
                className="flex items-center gap-2 text-destructive"
              >
                <Power className="h-4 w-4" />
                <span>Deactivate</span>
              </DropdownMenuItem>
            )}
            {user.status === "inactive" && (
              <DropdownMenuItem
                onSelect={() =>
                  handleAction(async () => {
                    try {
                      await meta.onToggleStatus(user);
                    } catch (error) {
                      console.error("Error activating user:", error);
                    }
                  })
                }
                className="flex items-center gap-2 text-green-600"
              >
                <Power className="h-4 w-4" />
                <span>Activate</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
