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
  const [metrics, setMetrics] = useState<TicketMetrics>({
    totalTickets: 0,
    closedTickets: 0,
    badRatings: 0,
    systemIssues: 0,
    newDrivers: 0,
    deactivatedDrivers: 0,
    avgResponseTime: 0,
    ticketTrend: 0, // percentage change from last month
    customerSatisfaction: 0,
    avgCloseTime: 0, // in minutes
    newCompanies: 0,
    deactivatedCompanies: 0,
  });

  const [companyMetrics, setCompanyMetrics] = useState<CompanyMetrics[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [monthlyTickets, setMonthlyTickets] = useState<MonthlyTickets[]>([]);
  const [recentBadRatings, setRecentBadRatings] = useState<DriverRating[]>([]);

  const [isLoading, setIsLoading] = useState({
    metrics: false,
    companyMetrics: false,
    userPerformance: false,
    monthlyTickets: false,
    recentBadRatings: false,
  });

  // Add new state for last updated time
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Add useEffect to handle time updates
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  // Fetch data when component mounts
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading({
      metrics: true,
      companyMetrics: true,
      userPerformance: true,
      monthlyTickets: true,
      recentBadRatings: true,
    });

    // Update last updated time
    setLastUpdated(new Date().toLocaleTimeString());

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMetrics({
      totalTickets: 150,
      closedTickets: 120,
      badRatings: 15,
      systemIssues: 8,
      newDrivers: 25,
      deactivatedDrivers: 5,
      avgResponseTime: 8.5, // minutes
      ticketTrend: 12.5, // 12.5% increase from last month
      customerSatisfaction: 87,
      avgCloseTime: 45.5, // Add average close time
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

    // Update monthly tickets data to only show closed tickets with trend
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString("default", { month: "short" });
    }).reverse();

    const monthlyClosedTickets = last12Months.map((month) => ({
      month,
      closedTickets: Math.floor(Math.random() * 150) + 50, // 50-200 closed tickets
      trend: Math.round(Math.random() * 40 - 20), // -20% to +20% trend
    }));

    setMonthlyTickets(monthlyClosedTickets);
    setIsLoading((prev) => ({ ...prev, monthlyTickets: false }));

    // Add mock bad ratings data
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
  };

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
