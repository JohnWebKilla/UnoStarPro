"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Ticket,
  Briefcase,
  Building,
  Car,
  Users,
  Calendar,
  CreditCard,
  BarChart,
} from "lucide-react";
import { signOutAction } from "@/app/Actions/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ROUTES, Role } from "@/utils/protected";
import { useMemo } from "react";

type NavItem = {
  path: string;
  icon: React.ElementType;
  label: string;
  roles: Role[];
};

// Define navigation items with their roles
const NAV_ITEMS: NavItem[] = [
  {
    path: "/Dashboard",
    icon: User,
    label: "Dashboard",
    roles: ["admin", "driver", "customer"],
  },
  {
    path: "/Tickets",
    icon: Ticket,
    label: "Tickets",
    roles: ["admin", "driver"],
  },
  {
    path: "/Companies",
    icon: Building,
    label: "Companies",
    roles: ["admin"],
  },
  {
    path: "/Drivers",
    icon: Car,
    label: "Drivers",
    roles: ["admin"],
  },
  {
    path: "/Users",
    icon: Users,
    label: "Users",
    roles: ["admin"],
  },
  {
    path: "/Paychecks",
    icon: CreditCard,
    label: "Paychecks",
    roles: ["admin", "driver"],
  },
  {
    path: "/Reports",
    icon: BarChart,
    label: "Reports",
    roles: ["admin"],
  },
];

interface TopNavProps {
  userRole: Role | null;
  userName: string;
  userEmail: string;
}

export function TopNav({ userRole, userName, userEmail }: TopNavProps) {
  const pathname = usePathname();

  const visibleNavItems = useMemo(() => {
    if (!userRole) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  }, [userRole]);

  const handleLogout = () => {
    signOutAction();
  };

  return (
    <nav className="bg-background shadow dark:bg-gray-800">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.webp" alt="Logo" className="h-8 mr-2" />
              <span className="text-xl font-bold">UNOSTAR</span>
            </Link>
          </div>

          {/* Menu Items */}
          <div className="flex-grow justify-center sm:space-x-8 hidden sm:flex">
            {visibleNavItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                href={path}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === path
                    ? "bg-blue-500 text-white dark:bg-blue-700"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
              >
                <Icon className="mr-2" /> {label}
              </Link>
            ))}
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0 sm:ml-6 sm:flex sm:items-center">
            <span className="mr-2">
              <ThemeSwitcher />
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src="/placeholder-avatar.jpg"
                      alt={userName || "@username"}
                    />
                    <AvatarFallback>
                      {userName
                        ? userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                        : "UN"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userName || "Guest User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail || "guest@example.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/profile" className="w-full">
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings" className="w-full">
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden hidden">
        <div className="pt-2 pb-3 space-y-1">
          {visibleNavItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              href={path}
              className={`${
                pathname === path
                  ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                  : "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            >
              <Icon className="mr-2 inline-block" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
