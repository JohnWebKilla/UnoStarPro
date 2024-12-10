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
import { signOutAction } from "@/app/actions";
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

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background shadow dark:bg-gray-800">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8">
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
            <Link
              href="/Dashboard"
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                pathname === "/Dashboard"
                  ? "bg-blue-500 text-white dark:bg-blue-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              <User className="mr-2" /> Dashboard
            </Link>
            <Link
              href="/Tickets"
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                pathname === "/Tickets"
                  ? "bg-blue-500 text-white dark:bg-blue-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              <Ticket className="mr-2" /> Tickets
            </Link>
            <Link
              href="/Tools"
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                pathname === "/Tools"
                  ? "bg-blue-500 text-white dark:bg-blue-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              <Briefcase className="mr-2" /> Tools
            </Link>
            <Link
              href="/companies"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <Building className="mr-2" /> Companies
            </Link>
            <Link
              href="/Drivers"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <Car className="mr-2" /> Drivers
            </Link>
            <Link
              href="/Users"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <Users className="mr-2" /> Users
            </Link>
            <Link
              href="/Schedules"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <Calendar className="mr-2" /> Schedules
            </Link>
            <Link
              href="/Paychecks"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <CreditCard className="mr-2" /> Paychecks
            </Link>
            <Link
              href="/Reports"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              <BarChart className="mr-2" /> Reports
            </Link>
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0 sm:ml-6 sm:flex sm:items-center">
            <span className="mr-2">
              {" "}
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
                      alt="@username"
                    />
                    <AvatarFallback>UN</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">John Doe</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      user@example.com
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className="sm:hidden hidden">
        <div className="pt-2 pb-3 space-y-1">
          <Link
            href="/dashboard"
            className="bg-indigo-50 border-indigo-500 text-indigo-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
          >
            Dashboard
          </Link>
          <Link
            href="/tickets"
            className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
          >
            Tickets
          </Link>
        </div>
        <div className="pt-4 pb-3 border-t border-gray-200">
          <div className="flex items-center px-4">
            <div className="flex-shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder-avatar.jpg" alt="@username" />
                <AvatarFallback>UN</AvatarFallback>
              </Avatar>
            </div>
            <div className="ml-3">
              <div className="text-base font-medium text-gray-800">
                User Name
              </div>
              <div className="text-sm font-medium text-gray-500">
                user@example.com
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Button
              variant="ghost"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
            >
              Profile
            </Button>
            <Button
              variant="ghost"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
            >
              Settings
            </Button>
            <Button
              variant="ghost"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
            >
              Log out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
