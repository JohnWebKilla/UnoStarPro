"use client";
import React, { useEffect, useState } from "react";
import { KeyMetrics } from "./components/KeyMetrics";
import { MonthlyTrend } from "./components/MonthlyTrend";
import { StatusChanges } from "./components/StatusChanges";
import { TeamPerformance } from "./components/TeamPerformance";
import { BadRatings } from "./components/BadRatings";
import {
  TicketMetrics,
  MonthlyTickets,
  UserPerformance,
  DriverRating,
} from "./types";
import { useUser } from "@/contexts/UserContext";
import { Skeleton } from "@/components/ui/skeleton";

interface CompanyMetrics {
  companyName: string;
  activeDrivers: number;
  avgRating: number;
  ratingDistribution: {
    "5": number;
    "4": number;
    "3": number;
    "2": number;
    "1": number;
  };
}

export default function Dashboard() {
  console.log("Dashboard component rendering");
  const { isLoading: isUserLoading, userRole } = useUser();
  console.log("User context values:", { isUserLoading, userRole });
  const [metrics, setMetrics] = useState<TicketMetrics>({
    totalTickets: 0,
    closedTickets: 0,
    badRatings: 0,
    systemIssues: 0,
    newDrivers: 0,
    deactivatedDrivers: 0,
    avgResponseTime: 0,
    ticketTrend: 0,
    customerSatisfaction: 0,
    avgCloseTime: 0,
    newCompanies: 0,
    deactivatedCompanies: 0,
  });

  const [companyMetrics, setCompanyMetrics] = useState<CompanyMetrics[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [monthlyTickets, setMonthlyTickets] = useState<MonthlyTickets[]>([]);
  const [recentBadRatings, setRecentBadRatings] = useState<DriverRating[]>([]);

  const [isLoading, setIsLoading] = useState({
    metrics: true,
    companyMetrics: true,
    userPerformance: true,
    monthlyTickets: true,
    recentBadRatings: true,
  });

  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    console.log("Dashboard mount effect running");
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  const fetchAllData = async () => {
    console.log("fetchAllData starting");
    try {
      setIsLoading({
        metrics: true,
        companyMetrics: true,
        userPerformance: true,
        monthlyTickets: true,
        recentBadRatings: true,
      });

      setLastUpdated(new Date().toLocaleTimeString());

      // Simulate API calls with delays
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMetrics({
        totalTickets: 150,
        closedTickets: 120,
        badRatings: 15,
        systemIssues: 8,
        newDrivers: 25,
        deactivatedDrivers: 5,
        avgResponseTime: 8.5,
        ticketTrend: 12.5,
        customerSatisfaction: 87,
        avgCloseTime: 45.5,
        newCompanies: 3,
        deactivatedCompanies: 1,
      });
      setIsLoading((prev) => ({ ...prev, metrics: false }));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setCompanyMetrics([
        {
          companyName: "Company A",
          activeDrivers: 120,
          avgRating: 4.5,
          ratingDistribution: {
            "5": 60,
            "4": 40,
            "3": 15,
            "2": 3,
            "1": 2,
          },
        },
        {
          companyName: "Company B",
          activeDrivers: 85,
          avgRating: 4.2,
          ratingDistribution: {
            "5": 35,
            "4": 30,
            "3": 12,
            "2": 5,
            "1": 3,
          },
        },
        {
          companyName: "Company C",
          activeDrivers: 65,
          avgRating: 4.7,
          ratingDistribution: {
            "5": 40,
            "4": 20,
            "3": 3,
            "2": 1,
            "1": 1,
          },
        },
      ]);
      setIsLoading((prev) => ({ ...prev, companyMetrics: false }));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setUserPerformance([
        {
          userName: "John Doe",
          email: "john.doe@unostar.com",
          closedTickets: 45,
          ticketsTrend: 12,
          avgCloseTime: 32.5,
          badRatingTickets: [
            { ticketId: "TKT-2024-001", rating: "bad" },
            { ticketId: "TKT-2024-003", rating: "bad" },
          ],
          onlineStatus: "online",
        },
        {
          userName: "Jane Smith",
          email: "jane.smith@unostar.com",
          closedTickets: 38,
          ticketsTrend: -5,
          avgCloseTime: 28.4,
          badRatingTickets: [
            { ticketId: "TKT-2024-002", rating: "bad" },
            { ticketId: "TKT-2024-005", rating: "good" },
          ],
          onlineStatus: "busy",
        },
        {
          userName: "Mike Johnson",
          email: "mike.johnson@unostar.com",
          closedTickets: 37,
          ticketsTrend: 8,
          avgCloseTime: 35.2,
          badRatingTickets: [
            { ticketId: "TKT-2024-004", rating: "bad" },
            { ticketId: "TKT-2024-006", rating: "good" },
            { ticketId: "TKT-2024-007", rating: "good" },
          ],
          onlineStatus: "offline",
        },
      ]);
      setIsLoading((prev) => ({ ...prev, userPerformance: false }));

      const last12Months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d.toLocaleString("default", { month: "short" });
      }).reverse();

      const monthlyClosedTickets = last12Months.map((month) => ({
        month,
        closedTickets: Math.floor(Math.random() * 150) + 50,
        trend: Math.round(Math.random() * 40 - 20),
      }));

      setMonthlyTickets(monthlyClosedTickets);
      setIsLoading((prev) => ({ ...prev, monthlyTickets: false }));

      setRecentBadRatings([
        {
          driverName: "John Smith",
          companyName: "Company A",
          rating: 2,
          comment: "Driver was late and unprofessional",
          timestamp: "2 hours ago",
          ticketId: "TKT-2024-001",
        },
        {
          driverName: "Mike Wilson",
          companyName: "Company B",
          rating: 1,
          comment: "No-show without notification",
          timestamp: "3 hours ago",
          ticketId: "TKT-2024-002",
        },
        {
          driverName: "Sarah Davis",
          companyName: "Company A",
          rating: 2,
          comment: "Poor communication and late delivery",
          timestamp: "5 hours ago",
          ticketId: "TKT-2024-003",
        },
        {
          driverName: "Robert Johnson",
          companyName: "Company C",
          rating: 1,
          comment: "Refused to follow delivery instructions",
          timestamp: "6 hours ago",
          ticketId: "TKT-2024-004",
        },
      ]);
      setIsLoading((prev) => ({ ...prev, recentBadRatings: false }));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Reset loading states on error
      setIsLoading({
        metrics: false,
        companyMetrics: false,
        userPerformance: false,
        monthlyTickets: false,
        recentBadRatings: false,
      });
    }
  };

  // Fetch data when component mounts and user is loaded
  useEffect(() => {
    console.log("Data fetching effect running:", { isUserLoading, userRole });
    if (!isUserLoading && userRole) {
      console.log("Conditions met, fetching data");
      fetchAllData();
    }
  }, [isUserLoading, userRole]);

  // Show loading skeleton while user is loading
  if (isUserLoading) {
    console.log("Rendering loading skeleton");
    return (
      <div className="space-y-4 bg-background/30 dark:bg-background/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-[400px] rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      </div>
    );
  }

  // Show nothing if no user role (will be redirected by layout)
  if (!userRole) {
    console.log("No user role, rendering null");
    return null;
  }

  console.log("Rendering dashboard content");
  return (
    <div className="space-y-4 bg-background/30 dark:bg-background/10">
      <KeyMetrics metrics={metrics} isLoading={isLoading.metrics} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MonthlyTrend
          monthlyTickets={monthlyTickets}
          isLoading={isLoading.monthlyTickets}
        />
        <StatusChanges metrics={metrics} isLoading={isLoading.metrics} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamPerformance
          userPerformance={userPerformance}
          isLoading={isLoading.userPerformance}
          onTicketClick={(ticketId) =>
            console.log(`Navigate to ticket ${ticketId}`)
          }
        />
        <BadRatings
          recentBadRatings={recentBadRatings}
          isLoading={isLoading.recentBadRatings}
          onTicketClick={(ticketId) =>
            console.log(`Navigate to ticket ${ticketId}`)
          }
        />
      </div>
    </div>
  );
}
