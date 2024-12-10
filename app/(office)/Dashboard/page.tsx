"use client";
import React, { useEffect, useState } from "react";
import { signOutAction } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TicketMetrics {
  totalTickets: number;
  closedTickets: number;
  badRatings: number;
  systemIssues: number;
  newDrivers: number;
  deactivatedDrivers: number;
}

interface CompanyMetrics {
  companyName: string;
  driverCalls: number;
}

interface UserPerformance {
  userName: string;
  closedTickets: number;
  badRatings: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<TicketMetrics>({
    totalTickets: 0,
    closedTickets: 0,
    badRatings: 0,
    systemIssues: 0,
    newDrivers: 0,
    deactivatedDrivers: 0,
  });

  const [companyMetrics, setCompanyMetrics] = useState<CompanyMetrics[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);

  // Fetch data when component mounts
  useEffect(() => {
    // TODO: Replace with actual API calls
    // Simulated data for demonstration
    setMetrics({
      totalTickets: 150,
      closedTickets: 120,
      badRatings: 15,
      systemIssues: 8,
      newDrivers: 25,
      deactivatedDrivers: 5,
    });

    setCompanyMetrics([
      { companyName: "Company A", driverCalls: 45 },
      { companyName: "Company B", driverCalls: 32 },
      { companyName: "Company C", driverCalls: 28 },
    ]);

    setUserPerformance([
      { userName: "John Doe", closedTickets: 45, badRatings: 3 },
      { userName: "Jane Smith", closedTickets: 38, badRatings: 2 },
      { userName: "Mike Johnson", closedTickets: 37, badRatings: 4 },
    ]);
  }, []);

  const handleRefresh = async () => {
    console.log("Refreshing data...");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Support Dashboard</h1>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Tickets</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.totalTickets}</p>
            <p className="text-sm text-gray-500">
              {metrics.closedTickets} closed (
              {Math.round((metrics.closedTickets / metrics.totalTickets) * 100)}
              %)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Driver Status</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-green-600">
                +{metrics.newDrivers} New Drivers
              </p>
              <p className="text-red-600">
                -{metrics.deactivatedDrivers} Deactivated
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.systemIssues}</p>
            <p className="text-sm text-gray-500">reported issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Calls Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Calls by Company</CardTitle>
          <CardDescription>Number of support calls per company</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={companyMetrics}>
              <XAxis dataKey="companyName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="driverCalls" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* User Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Support Team Performance</CardTitle>
          <CardDescription>
            Tickets closed and ratings this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Support Agent</th>
                  <th className="text-left py-2">Closed Tickets</th>
                  <th className="text-left py-2">Bad Ratings</th>
                  <th className="text-left py-2">Performance Score</th>
                </tr>
              </thead>
              <tbody>
                {userPerformance.map((user, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{user.userName}</td>
                    <td className="py-2">{user.closedTickets}</td>
                    <td className="py-2">{user.badRatings}</td>
                    <td className="py-2">
                      {Math.round(
                        ((user.closedTickets - user.badRatings) /
                          user.closedTickets) *
                          100
                      )}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
