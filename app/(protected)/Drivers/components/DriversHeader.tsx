"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Users, UserCheck, AlertTriangle } from "lucide-react";
import { AddDriverDialog } from "./AddDriverDialog";
import { useDrivers } from "./DriversProvider";

interface Document {
  id: number;
  expiration_date: string;
}

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  status: string;
  driver_licenses: Document[];
  medical_cards: Document[];
  mvr_files: Document[];
}

export function DriversHeader() {
  const { drivers, loading, refreshDrivers } = useDrivers();

  const hasExpiringDocuments = (driver: Driver) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const checkExpiration = (docs: Document[]) => {
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground">
            Manage your drivers and their documents
          </p>
        </div>
        <AddDriverDialog onDriverAdded={refreshDrivers} />
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
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  drivers.length
                )}
              </div>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            {!loading && drivers.length > 0 && (
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
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  activeDrivers.length
                )}
              </div>
              <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-900">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            {!loading && drivers.length > 0 && (
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
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  expiringDocsCount
                )}
              </div>
              <div className="rounded-full bg-yellow-100 p-2 text-yellow-600 dark:bg-yellow-900">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {!loading && drivers.length > 0 && (
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
