"use client";

import React, { useState } from "react";
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
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Database,
  Trash,
} from "lucide-react";
import { AddDriverDialog } from "./AddDriverDialog";
import { useDrivers } from "./DriversProvider";
import { Badge } from "@/components/ui/badge";
import { Driver } from "../types";

export function DriversHeader() {
  const {
    drivers,
    loading,
    refreshDrivers,
    dataSource,
    timingInfo,
    clearCache,
  } = useDrivers();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async (useCache: boolean = true) => {
    setRefreshing(true);
    try {
      await refreshDrivers(!useCache); // if useCache is false, pass true to skipCache
    } finally {
      setRefreshing(false);
    }
  };

  const hasExpiringDocuments = (driver: Driver) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const checkExpiration = (docs: any[]) => {
      return docs.some((doc) => {
        const expirationDate = new Date(doc.expiration_date);
        return expirationDate <= thirtyDaysFromNow;
      });
    };

    return (
      checkExpiration(driver.driver_licenses) ||
      checkExpiration(driver.medical_cards) ||
      checkExpiration(driver.mvr_files)
    );
  };

  const activeDrivers = drivers.filter((d) => d.status === "Active");
  const expiringDocsCount = drivers.filter(hasExpiringDocuments).length;

  const getDataSourceColor = () => {
    if (dataSource === "Database")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    if (dataSource === "Redis Cache")
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    if (dataSource === "Client Cache (API)")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (dataSource === "Client Cache (Local)")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Drivers</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              Manage your drivers and their documents
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
        <div className="flex gap-2">
          <Button
            className="h-9 relative z-0"
            variant="outline"
            onClick={() => clearCache()}
            disabled={loading || refreshing}
          >
            Clear Cache
          </Button>
          <AddDriverDialog onDriverAdded={() => refreshDrivers(true)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <CardDescription>Active and inactive drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {loading || refreshing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  drivers.length
                )}
              </div>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            {!loading && !refreshing && drivers.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active Drivers
            </CardTitle>
            <CardDescription>Currently working drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {loading || refreshing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  activeDrivers.length
                )}
              </div>
              <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-900">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            {!loading && !refreshing && drivers.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-100 dark:bg-green-900">
                <div
                  className="h-full bg-green-600 transition-all duration-500"
                  style={{
                    width: `${(activeDrivers.length / drivers.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring Documents
            </CardTitle>
            <CardDescription>Documents expiring in 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-yellow-600">
                {loading || refreshing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  expiringDocsCount
                )}
              </div>
              <div className="rounded-full bg-yellow-100 p-2 text-yellow-600 dark:bg-yellow-900">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {!loading && !refreshing && drivers.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-100 dark:bg-yellow-900">
                <div
                  className="h-full bg-yellow-600 transition-all duration-500"
                  style={{
                    width: `${(expiringDocsCount / drivers.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
