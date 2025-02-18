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
  DollarSign,
  Menu,
  X,
  Crown,
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
import { NotificationButton } from "@/components/notification-button";
import { ROUTES, Role } from "@/utils/protected";
import { useMemo, useState } from "react";
import { useBirthdayCheck } from "@/hooks/useBirthdayCheck";
import { motion } from "framer-motion";

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
    path: "/Expenses",
    icon: DollarSign,
    label: "Expenses",
    roles: ["admin"],
  },
  {
    path: "/Performance",
    icon: BarChart,
    label: "Performance",
    roles: ["admin"],
  },
  {
    path: "/Scheduling",
    icon: Calendar,
    label: "Scheduling",
    roles: ["admin"],
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isBirthday = useBirthdayCheck();

  const visibleNavItems = useMemo(() => {
    if (!userRole) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  }, [userRole]);

  const handleLogout = () => {
    signOutAction();
  };

  return (
    <nav className="bg-background shadow dark:bg-gray-900 sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.webp" alt="Logo" className="h-8 mr-2" />
              <span className="text-xl font-bold">UNOSTAR</span>
            </Link>
          </div>

          {/* Desktop Menu Items - Modified for better spacing */}
          <div className="flex-grow justify-start pl-8 space-x-2 hidden lg:flex overflow-x-auto">
            {visibleNavItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                href={path}
                className={`inline-flex items-center px-2 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  pathname === path
                    ? "bg-blue-500 text-white dark:bg-blue-900"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 mr-1" /> {label}
              </Link>
            ))}
          </div>

          {/* Avatar and Theme Switcher */}
          <div className="flex items-center space-x-2">
            <span className="hidden lg:block">
              <ThemeSwitcher />
            </span>
            <span className="hidden lg:block">
              <NotificationButton />
            </span>

            {/* Mobile menu button - Changed breakpoint from sm to lg */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  {isBirthday && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute -top-2 -right-1 z-10"
                    >
                      <Crown
                        className="h-5 w-5 text-yellow-500 rotate-[30deg]"
                        fill="currentColor"
                        strokeWidth={1.5}
                      />
                    </motion.div>
                  )}
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

      {/* Mobile menu - Changed breakpoint from sm to lg */}
      <div
        className={`lg:hidden ${
          isMobileMenuOpen ? "block" : "hidden"
        } border-t dark:border-gray-700`}
      >
        <div className="pt-2 pb-3 space-y-1">
          {visibleNavItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              href={path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`${
                pathname === path
                  ? "bg-blue-500 text-white dark:bg-blue-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              } flex items-center px-4 py-2 text-base font-medium`}
            >
              <Icon className="mr-3 h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
        {/* Mobile ThemeSwitcher */}
        <div className="px-4 py-3 border-t dark:border-gray-700">
          <div className="flex items-center">
            <span className="mr-2">Theme:</span>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
}
