"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  format,
  startOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Loader2, Database, RefreshCw, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getSchedulingData,
  clearSchedulingCaches,
} from "../actions/client-actions";
import type { Employee, Absence } from "../types";

export default function CachedShiftSchedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);

  // Date range for data fetching
  const dateRange = useMemo(
    () => ({
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate),
    }),
    [selectedDate]
  );

  const fetchSchedulingData = useCallback(
    async (skipCache: boolean = false) => {
      if (!dateRange.start || !dateRange.end) return;

      try {
        setIsLoading(true);
        setDataSource("database");
        setTimingInfo(null);

        const result = await getSchedulingData(
          dateRange.start,
          dateRange.end,
          skipCache
        );

        setEmployees(result.data.employees);
        setAbsences(result.data.absences);
        setSchedules(result.data.schedules);
        setDataSource(result.source);
        setTimingInfo(result.timing);

        console.log(
          `Loaded scheduling data from ${result.source} in ${result.timing.total.toFixed(0)}ms`
        );
      } catch (error) {
        console.error("Error fetching scheduling data:", error);
        toast.error("Failed to load scheduling data");
      } finally {
        setIsLoading(false);
      }
    },
    [dateRange]
  );

  // Initialize data
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchSchedulingData();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fetchSchedulingData]);

  // Handle date change
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  // Handle refresh/clear cache
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await clearSchedulingCaches({
        start: dateRange.start,
        end: dateRange.end,
      });
      await fetchSchedulingData(true);
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Render data source indicator
  const renderDataSourceIndicator = () => {
    // If we're still loading or don't have timing info, don't show anything
    if (isLoading || !timingInfo) {
      return null;
    }

    // Get color based on data source
    const getDataSourceColor = () => {
      if (dataSource === "database")
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";

      if (timingInfo?.source === "server" && dataSource === "cache")
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";

      if (timingInfo?.source === "client-cache")
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";

      if (timingInfo?.source === "local-storage")
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";

      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    };

    // Get user-friendly name of the data source
    const getDataSourceName = () => {
      if (dataSource === "database") return "Database";

      if (timingInfo?.source === "server" && dataSource === "cache")
        return "Redis Cache";

      if (timingInfo?.source === "client-cache") return "Client Cache (API)";

      if (timingInfo?.source === "local-storage") return "Client Cache (Local)";

      return dataSource;
    };

    return (
      <Badge
        variant="outline"
        className={`${getDataSourceColor()} flex items-center gap-1 ml-2`}
      >
        <Database className="h-3 w-3" />
        {getDataSourceName()}
        {timingInfo && (
          <span className="ml-1 text-xs">
            ({(timingInfo.total / 1000).toFixed(2)}s)
          </span>
        )}
      </Badge>
    );
  };

  // Week navigation component
  const WeekNavigation = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

    return (
      <div className="flex items-center justify-between space-x-2 p-2 bg-muted/30 rounded-md">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDateChange(addDays(selectedDate, -7))}
          className="h-8"
        >
          Previous Week
        </Button>
        <div className="flex items-center">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>
            {format(weekStart, "MMM d")} -{" "}
            {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDateChange(addDays(selectedDate, 7))}
          className="h-8"
        >
          Next Week
        </Button>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1920px] mx-auto space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Shift Scheduler
            </CardTitle>
            <div className="flex items-center mt-1">
              <span className="text-sm text-muted-foreground">
                Manage employee shifts and absences
              </span>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm ml-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading data...
                </div>
              ) : (
                renderDataSourceIndicator()
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Data
          </Button>
        </CardHeader>
        <CardContent>
          <WeekNavigation />

          {/* Schedule content would go here */}
          <div className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Loading scheduling data...
                </span>
              </div>
            ) : (
              <div>
                <div className="text-sm text-muted-foreground mb-4">
                  <span>
                    Total Employees: <strong>{employees.length}</strong>
                  </span>
                  <span className="mx-2">|</span>
                  <span>
                    Active Schedules: <strong>{schedules.length}</strong>
                  </span>
                  <span className="mx-2">|</span>
                  <span>
                    Absences This Month: <strong>{absences.length}</strong>
                  </span>
                </div>

                {/* Simplified schedule view */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Morning Shift</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {
                          schedules.filter((s) => s.working_shift === "1")
                            .length
                        }{" "}
                        employees
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Afternoon Shift</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {
                          schedules.filter((s) => s.working_shift === "2")
                            .length
                        }{" "}
                        employees
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Night Shift</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {
                          schedules.filter((s) => s.working_shift === "3")
                            .length
                        }{" "}
                        employees
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
