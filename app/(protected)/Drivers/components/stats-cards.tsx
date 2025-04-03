"use client";

import { useDrivers } from "./DriversProvider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
  Activity,
} from "lucide-react";

export function StatsCards() {
  const { drivers } = useDrivers();

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(
    (d) => d.status?.toLowerCase() === "active"
  ).length;
  const inactiveDrivers = totalDrivers - activeDrivers;
  const totalRevenue = drivers.reduce(
    (sum, d) => sum + (d.subscription?.amount || d.subscription_amount || 0),
    0
  );

  const expiringDocuments = drivers.reduce((sum, d) => {
    const allDocs = [
      ...(Array.isArray(d.documents) ? d.documents : []),
      ...(Array.isArray(d.driver_licenses) ? d.driver_licenses : []),
      ...(Array.isArray(d.medical_cards) ? d.medical_cards : []),
      ...(Array.isArray(d.mvr_files) ? d.mvr_files : []),
    ];

    const hasExpiringDocs = allDocs.some((doc) => {
      if (!doc) return false;
      const expiryDate = new Date(
        "expiryDate" in doc && doc.expiryDate
          ? doc.expiryDate
          : "expiration_date" in doc
            ? doc.expiration_date
            : ""
      );
      if (isNaN(expiryDate.getTime())) return false;
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate <= thirtyDaysFromNow;
    });

    return sum + (hasExpiringDocs ? 1 : 0);
  }, 0);

  const expiringPercentage =
    totalDrivers > 0 ? Math.round((expiringDocuments / totalDrivers) * 100) : 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-full">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Drivers
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{totalDrivers}</h2>
                <span className="text-sm text-green-600">
                  ↗{Math.round((activeDrivers / (totalDrivers || 1)) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-full">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-bold">{activeDrivers}</h2>
                  <span className="text-sm text-muted-foreground">active</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {inactiveDrivers} inactive
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-full">
              <Receipt className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Subscriptions
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{activeDrivers}</h2>
                <span className="text-sm text-muted-foreground">
                  100% active
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-full">
              <DollarSign className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Revenue
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">${totalRevenue}</h2>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-full">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Issues
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{expiringDocuments}</h2>
                <span className="text-sm text-muted-foreground">
                  {expiringPercentage}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
