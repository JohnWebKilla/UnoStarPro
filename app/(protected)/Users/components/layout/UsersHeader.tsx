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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "../providers/UsersProvider";
import { UserDialog } from "../dialogs/user-dialog";
import { useState } from "react";
import { User } from "../../lib/types/types";

export function UsersHeader() {
  const { users, loading, dataSource, timingInfo, clearCache, companies } =
    useUsers();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const activeUsers = users.filter((u) => u.status === "active");
  const adminUsers = users.filter((u) => u.role === "admin");
  const usersWithCompanies = users.filter((u) => u.company_id !== null);

  const getDataSourceColor = () => {
    if (dataSource === "Database")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    if (dataSource === "Client Cache (API)")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (dataSource === "Client Cache (Local)")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Users</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              Manage your system users and their permissions
            </p>
            {!loading && (
              <Badge
                variant="outline"
                className={`${getDataSourceColor()} flex items-center gap-1`}
              >
                <Database className="h-3 w-3" />
                {dataSource}
                {timingInfo && (
                  <span className="ml-1 text-xs">
                    ({(timingInfo.total / 1000).toFixed(2)}s)
                  </span>
                )}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearCache}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          <UserDialog
            open={isAddUserOpen}
            onOpenChange={setIsAddUserOpen}
            companies={companies}
          />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <CardDescription>Active and inactive users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  users.length
                )}
              </div>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <CardDescription>Users with admin privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  adminUsers.length
                )}
              </div>
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Company Associated
            </CardTitle>
            <CardDescription>Users linked to companies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  usersWithCompanies.length
                )}
              </div>
              <div className="rounded-full bg-purple-100 p-2 text-purple-600 dark:bg-purple-900">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
