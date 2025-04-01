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
import { ROUTES } from "@/utils/protected";
import type { Role } from "@/types/role";
import { useMemo, useState, useEffect } from "react";
import { useBirthdayCheck } from "@/hooks/useBirthdayCheck";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

type NavItem = {
  path: string;
  icon: React.ElementType;
  label: string;
  roles: Role[];
};

interface TopNavProps {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
  isLoading?: boolean;
}

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

// Common navigation items that are shown during loading
const COMMON_NAV_ITEMS = NAV_ITEMS.filter(
  (item) =>
    // Show items that are either available to all users
    // or commonly accessed items (admin + driver items)
    item.roles.includes("admin" as Role) ||
    (item.roles.includes("driver" as Role) &&
      !item.roles.includes("admin" as Role))
);

// Add loading skeleton for the nav items
function NavItemSkeleton() {
  return <div className="h-9 w-24 bg-muted animate-pulse rounded"></div>;
}

export function TopNav({
  userRole,
  userName,
  userEmail,
  isLoading = false,
}: TopNavProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isBirthday = useBirthdayCheck();
  const router = useRouter();

  // Use common items during loading, otherwise use role-specific items
  const visibleNavItems = useMemo(() => {
    if (isLoading) {
      // During loading, show a subset of navigation items
      return COMMON_NAV_ITEMS;
    }
    if (!userRole) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  }, [userRole, isLoading]);

  const handleLogout = async () => {
    try {
      const result = await signOutAction();

      if (!result.success) {
        console.error("Logout error:", result.error);
        return;
      }

      // Clear local storage
      localStorage.clear();

      // Use window.location.href for a full page refresh
      window.location.href = "/sign-in";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4">
        {/* Left section with logo */}
        <div className="flex-none">
          <Link href="/Dashboard" className="flex items-center space-x-2">
            <Image
              src="/logo.webp"
              alt="UnoStar Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="font-bold">UNOSTAR</span>
          </Link>
        </div>

        {/* Center section with nav items */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="flex items-center space-x-2">
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors rounded-md",
                  pathname?.startsWith(item.path)
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right section with actions */}
        <div className="flex-none flex items-center space-x-4">
          <ThemeSwitcher />
          {isLoading ? (
            <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
          ) : (
            <NotificationButton />
          )}

          {/* User Menu */}
          {isLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${userName}`}
                      alt={userName || ""}
                    />
                    <AvatarFallback>
                      {userName
                        ? userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  {isBirthday && (
                    <span className="absolute -right-1 -top-1">
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/Profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/Settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={handleLogout}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            className="md:hidden"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                  pathname?.startsWith(item.path)
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-accent"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
