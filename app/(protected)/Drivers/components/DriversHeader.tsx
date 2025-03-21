"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AddDriverDialog } from "./AddDriverDialog";
import { useDrivers } from "./DriversProvider";

interface Document {
  id: number;
  expiration_date: string;
}

interface Driver {
  id: number;
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

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drivers</h1>
          <p className="text-muted-foreground">
            Manage your drivers and their documents
          </p>
        </div>
        <AddDriverDialog onDriverAdded={refreshDrivers} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Drivers</CardTitle>
            <CardDescription>Active and inactive drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                drivers.length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Drivers</CardTitle>
            <CardDescription>Currently working drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                drivers.filter((d) => d.status === "Active").length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expiring Documents</CardTitle>
            <CardDescription>Documents expiring in 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                drivers.filter(hasExpiringDocuments).length
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
