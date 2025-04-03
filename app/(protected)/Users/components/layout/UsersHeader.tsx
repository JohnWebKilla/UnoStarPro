"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Users,
  ShieldCheck,
  Building2,
  Database,
  PlusCircle,
  RefreshCw,
  Plus,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "../providers/UsersProvider";
import { UserDialog } from "../dialogs/user-dialog";
import { useState } from "react";
import { User } from "../../lib/types/types";
import { cn } from "@/lib/utils";

interface UsersHeaderProps {
  onAddUser?: () => void;
}

export function UsersHeader({ onAddUser }: UsersHeaderProps) {
  const { users, loading, dataSource, timingInfo, clearCache, companies } =
    useUsers();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const usersWithCompanies = users.filter((u) => u.company_id !== null).length;

  const getDataSourceColor = () => {
    if (dataSource === "Database")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    if (
      dataSource === "Client Cache (API)" ||
      dataSource === "Client Cache (Local)"
    )
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const getDisplayDataSource = (source: string) => {
    if (source === "Client Cache (Local)") return "Local Cache";
    if (source === "Client Cache (API)") return "API Cache";
    return source;
  };

  return (
    <>
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-none rounded-lg shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Users
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your system users and their permissions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-md text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <Database className="h-3.5 w-3.5" />
              <span className="font-medium">
                {dataSource === "Client Cache (Local)"
                  ? "Local Cache"
                  : dataSource}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCache}
              className="h-9"
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
              />
              Clear Cache
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddUserOpen(true)}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Total Users
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  totalUsers
                )}
              </span>
              <div className="flex items-center ml-2 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20 rounded-full px-1.5 py-0.5">
                {Math.round((activeUsers / (totalUsers || 1)) * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Status
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  activeUsers
                )}
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {Math.round((activeUsers / (totalUsers || 1)) * 100)}% active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20">
              <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Admins
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  adminUsers
                )}
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {Math.round((adminUsers / (totalUsers || 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 p-3 rounded-lg bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
              <Building2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              With Company
            </p>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  usersWithCompanies
                )}
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {Math.round((usersWithCompanies / (totalUsers || 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
