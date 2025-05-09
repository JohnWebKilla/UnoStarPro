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
  Crown,
  ChevronLeft,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  Home,
} from "lucide-react";
import { signOutAction } from "@/app/Actions/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { NotificationButton } from "@/components/notification-button";
import { ROUTES } from "@/utils/protected";
import type { Role } from "@/types/role";
import { useMemo } from "react";
import { useBirthdayCheck } from "@/hooks/useBirthdayCheck";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/contexts/SidebarContext";
import { useNotifications } from "@/app/(protected)/Banners/components/NotificationProvider";
import { Banner } from "@/app/(protected)/Banners/components/Banner";

type NavItem = {
  path: string;
  icon: React.ElementType;
  label: string;
  roles: Role[];
  badge?: string;
};

interface SideNavProps {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
  isLoading?: boolean;
  children: React.ReactNode;
}

// Define navigation items with their roles
const NAV_ITEMS: NavItem[] = [
  {
    path: "/Dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "driver", "customer"],
  },
  {
    path: "/Tickets",
    icon: Ticket,
    label: "Tickets",
    roles: ["admin", "driver"],
    badge: "New",
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
    item.roles.includes("admin" as Role) ||
    (item.roles.includes("driver" as Role) &&
      !item.roles.includes("admin" as Role))
);

export function SideNav({
  userRole,
  userName,
  userEmail,
  isLoading = false,
  children,
}: SideNavProps) {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const {
    activeNotifications,
    hideNotification,
    dismissedNotifications,
    setDismissedNotifications,
  } = useNotifications();
  const isBirthday = useBirthdayCheck();
  const router = useRouter();

  const hasActiveBanner = useMemo(() => {
    return activeNotifications.some(
      (notification) =>
        notification.displayType === "banner" &&
        notification.active &&
        (!notification.showFrom ||
          new Date(notification.showFrom) <= new Date()) &&
        (!notification.showUntil ||
          new Date(notification.showUntil) >= new Date())
    );
  }, [activeNotifications]);

  const visibleNavItems = useMemo(() => {
    return isLoading
      ? COMMON_NAV_ITEMS
      : userRole
        ? NAV_ITEMS.filter((item) => item.roles.includes(userRole))
        : [];
  }, [userRole, isLoading]);

  const handleLogout = async () => {
    try {
      const result = await signOutAction();
      if (!result.success) {
        console.error("Logout error:", result.error);
        return;
      }
      localStorage.clear();
      window.location.href = "/sign-in";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getActiveBanners = () => {
    return activeNotifications.filter(
      (notification) =>
        notification.displayType === "banner" &&
        notification.active &&
        (!notification.showFrom ||
          new Date(notification.showFrom) <= new Date()) &&
        (!notification.showUntil ||
          new Date(notification.showUntil) >= new Date()) &&
        !dismissedNotifications?.includes(notification.id)
    );
  };

  const activeBanners = useMemo(
    () => getActiveBanners(),
    [activeNotifications]
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <motion.nav
        initial={false}
        animate={{
          width: isCollapsed ? "64px" : "280px",
          transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
        }}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          isCollapsed ? "items-center" : "items-stretch"
        )}
      >
        {/* Logo Section */}
        <div
          className={cn(
            "flex h-[70px] items-center border-b",
            isCollapsed ? "justify-center" : "px-6"
          )}
        >
          <Link href="/Dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.webp"
              alt="UnoStar Logo"
              width={36}
              height={36}
              className="rounded-md"
            />
            <AnimatePresence mode="popLayout">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="font-semibold tracking-wide text-lg"
                >
                  UNOSTAR
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Navigation Items */}
        <div
          className={cn(
            "flex-1 overflow-y-auto py-6",
            isCollapsed ? "px-2" : "px-3"
          )}
        >
          <TooltipProvider delayDuration={0}>
            {visibleNavItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 py-2.5 mb-2 text-sm font-medium rounded-lg group relative",
                      pathname?.startsWith(item.path)
                        ? "bg-primary text-primary-foreground dark:bg-primary/70"
                        : "hover:bg-accent hover:text-accent-foreground",
                      isCollapsed ? "justify-center px-2" : "px-3",
                      "transition-all duration-200 ease-in-out"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200",
                        pathname?.startsWith(item.path)
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <AnimatePresence mode="popLayout">
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {item.badge && !isCollapsed && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Badge
                          variant="default"
                          className="ml-auto text-[10px] px-1.5 h-5"
                        >
                          {item.badge}
                        </Badge>
                      </motion.div>
                    )}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent
                    side="right"
                    className="flex items-center gap-2"
                  >
                    {item.label}
                    {item.badge && (
                      <Badge
                        variant="default"
                        className="text-[10px] px-1.5 h-5"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Bottom Section */}
        <div className="mt-auto border-t">
          {/* Quick Actions */}
          <div
            className={cn(
              "flex",
              isCollapsed
                ? "flex-col items-center py-4 gap-4"
                : "h-14 items-center justify-center gap-6 px-6"
            )}
          >
            <TooltipProvider delayDuration={0}>
              {isCollapsed ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <ThemeSwitcher />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Theme</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <NotificationButton />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Notifications</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <ThemeSwitcher />
                  <NotificationButton />
                </>
              )}
            </TooltipProvider>
          </div>

          {/* User Menu */}
          {isLoading ? (
            <div
              className={cn(
                "rounded-full bg-muted animate-pulse",
                isCollapsed ? "h-8 w-8 mx-auto my-2" : "h-9 w-9 mx-4 mb-3"
              )}
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative w-full flex items-center gap-3 hover:bg-muted/50 transition-colors",
                    isCollapsed ? "justify-center py-2" : "px-6 py-3"
                  )}
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
                  <AnimatePresence mode="popLayout">
                    {!isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="flex flex-col items-start overflow-hidden"
                      >
                        <span className="text-sm font-medium truncate max-w-[150px]">
                          {userName}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {userEmail}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {isBirthday && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute -right-1 -top-1"
                    >
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </motion.span>
                  )}
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align={isCollapsed ? "center" : "start"}
                forceMount
              >
                <DropdownMenuItem asChild>
                  <Link href="/Profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/Settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 dark:text-red-400"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Collapse Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-10 hover:bg-muted/50 transition-colors flex items-center justify-center border-t"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <motion.div
              initial={false}
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.div>
          </motion.button>
        </div>
      </motion.nav>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{
          marginLeft: isCollapsed ? "64px" : "280px",
          width: isCollapsed ? "calc(100% - 64px)" : "calc(100% - 280px)",
        }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="h-screen flex flex-col"
      >
        <AnimatePresence mode="sync">
          {activeBanners.length > 0 && (
            <Banner
              message={activeBanners[0]}
              onDismiss={(id) => {
                // Just call hideNotification, the Banner component will handle the animation
                hideNotification(id);
              }}
              totalBanners={activeBanners.length}
              currentIndex={0}
            />
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-hidden">{children}</div>
      </motion.main>
    </div>
  );
}
