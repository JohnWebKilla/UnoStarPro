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
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="py-4 px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold">Users</h1>
              <p className="text-muted-foreground">
                Manage your system users and their permissions
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && (
                <Badge
                  variant="outline"
                  className={`${getDataSourceColor()} flex items-center gap-1 h-7`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {getDisplayDataSource(dataSource)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearCache}
                disabled={loading}
                className="h-7"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAddUserOpen(true)}
                className="h-7"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Total Users</p>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    users.length
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Admin Users</p>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    adminUsers.length
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2 text-purple-600 dark:bg-purple-900">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Company Associated</p>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    usersWithCompanies.length
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
