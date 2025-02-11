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
import { MoreHorizontal, Check, X, Cake, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateUserStatus } from "./actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: string;
  created_at: string;
  dob?: string;
  avatar?: string;
  associated_companies?: string[];
  // ... any other properties your user object might have
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
  setSelectedUser: (user: User) => void;
  setDialogOpen: (open: boolean) => void;
  onDataChange?: () => void;
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
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                meta.setSelectedUser(user);
                meta.setDialogOpen(true);
              }}
            >
              Edit
            </DropdownMenuItem>
            {user.status === "active" && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await updateUserStatus(user.id, "inactive");
                    meta.onDataChange?.();
                  } catch (error) {
                    console.error("Error deactivating user:", error);
                  }
                }}
                className="text-destructive"
              >
                Deactivate
              </DropdownMenuItem>
            )}
            {user.status === "inactive" && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await updateUserStatus(user.id, "active");
                    meta.onDataChange?.();
                  } catch (error) {
                    console.error("Error activating user:", error);
                  }
                }}
                className="text-green-600"
              >
                Activate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
