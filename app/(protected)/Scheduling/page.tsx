"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Clock, Download } from "lucide-react";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  useMemo,
  Suspense,
  memo,
  useCallback,
  useTransition,
} from "react";
import { getInitialSchedulingData, SchedulingStats } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";

// Define component props type
interface ComponentProps {
  className?: string;
}

// Dynamically import components with loading boundaries
const ShiftSchedule = dynamic<ComponentProps>(
  () => import("./components/shift-schedule"),
  {
    loading: () => <Skeleton className="h-[500px] w-full" />,
    ssr: false,
  }
);

const ScheduleManagement = dynamic<ComponentProps>(
  () => import("./components/schedule-management"),
  {
    loading: () => <Skeleton className="h-[500px] w-full" />,
    ssr: false,
  }
);

const AbsenceCalendar = dynamic<ComponentProps>(
  () => import("./components/AbsenceCalendar"),
  {
    loading: () => <Skeleton className="h-[500px] w-full" />,
    ssr: false,
  }
);

// Prefetch components based on viewport visibility
const prefetchComponent = (component: string) => {
  switch (component) {
    case "schedule":
      import("./components/shift-schedule");
      break;
    case "management":
      import("./components/schedule-management");
      break;
    case "absences":
      import("./components/AbsenceCalendar");
      break;
  }
};

// Create a context for scheduling data
interface SchedulingContextType {
  stats: SchedulingStats;
  employees: any[];
  absences: any[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const SchedulingContext = createContext<SchedulingContextType>({
  stats: { totalEmployees: 0, activeShifts: 0, todayAbsences: 0, error: null },
  employees: [],
  absences: [],
  isLoading: true,
  refreshData: async () => {},
});

export const useScheduling = () => useContext(SchedulingContext);

// Separate StatCard into its own component for better memoization
const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
  error,
}: {
  icon: any;
  label: string;
  value: number;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <Card className="p-6 flex items-start space-x-4">
      <div className="p-3 bg-primary/10 rounded-lg">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isLoading ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : error ? (
          <p className="text-sm text-red-500">Error loading data</p>
        ) : (
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        )}
      </div>
    </Card>
  );
});

// Separate StatsCards into its own component
const StatsCards = memo(function StatsCards({
  stats,
  isLoading,
}: {
  stats: SchedulingStats;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        icon={Users}
        label="Total Employees"
        value={stats.totalEmployees}
        isLoading={isLoading}
        error={stats.error}
      />
      <StatCard
        icon={Clock}
        label="Active Shifts"
        value={stats.activeShifts}
        isLoading={isLoading}
        error={stats.error}
      />
      <StatCard
        icon={CalendarDays}
        label="Today's Absences"
        value={stats.todayAbsences}
        isLoading={isLoading}
        error={stats.error}
      />
    </div>
  );
});

// Optimize tab content rendering with proper suspense boundaries
const TabContent = memo(function TabContent({
  activeTab,
  isLoading,
}: {
  activeTab: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  switch (activeTab) {
    case "schedule":
      return (
        <ErrorBoundary>
          <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
            <ShiftSchedule className="h-full" />
          </Suspense>
        </ErrorBoundary>
      );
    case "management":
      return (
        <ErrorBoundary>
          <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
            <ScheduleManagement className="h-full" />
          </Suspense>
        </ErrorBoundary>
      );
    case "absences":
      return (
        <ErrorBoundary>
          <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
            <AbsenceCalendar className="h-full" />
          </Suspense>
        </ErrorBoundary>
      );
    default:
      return null;
  }
});

// Client component
export default function SchedulePage() {
  const [state, setState] = useState<{
    stats: SchedulingStats;
    employees: any[];
    absences: any[];
    isLoading: boolean;
    activeTab: string;
  }>({
    stats: {
      totalEmployees: 0,
      activeShifts: 0,
      todayAbsences: 0,
      error: null,
    },
    employees: [],
    absences: [],
    isLoading: true,
    activeTab: "schedule",
  });

  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const data = await getInitialSchedulingData(startDate, endDate);
      startTransition(() => {
        setState((prev) => ({
          ...prev,
          stats: data.stats,
          employees: data.employees || [],
          absences: data.absences || [],
          isLoading: false,
        }));
      });
    } catch (error) {
      console.error("Failed to fetch scheduling data:", error);
      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          error:
            error instanceof Error ? error.message : "Failed to fetch data",
        },
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize context value
  const contextValue = useMemo(
    () => ({
      stats: state.stats,
      employees: state.employees,
      absences: state.absences,
      isLoading: state.isLoading || isPending,
      refreshData: fetchData,
    }),
    [state, isPending, fetchData]
  );

  // Memoize tab content
  const tabContent = useMemo(
    () => (
      <TabContent
        activeTab={state.activeTab}
        isLoading={state.isLoading || isPending}
      />
    ),
    [state.activeTab, state.isLoading, isPending]
  );

  return (
    <SchedulingContext.Provider value={contextValue}>
      <div className="container mx-auto py-10 space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Scheduling Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage shifts, schedules, and track absences
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Schedule
            </Button>
          </div>
        </div>

        <StatsCards
          stats={state.stats}
          isLoading={state.isLoading || isPending}
        />

        <ErrorBoundary>
          <Tabs
            value={state.activeTab}
            onValueChange={(tab) =>
              setState((prev) => ({ ...prev, activeTab: tab }))
            }
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <TabsList className="bg-muted/50">
                <TabsTrigger
                  value="schedule"
                  className="data-[state=active]:bg-background"
                >
                  Weekly Schedule
                </TabsTrigger>
                <TabsTrigger
                  value="management"
                  className="data-[state=active]:bg-background"
                >
                  Schedule Management
                </TabsTrigger>
                <TabsTrigger
                  value="absences"
                  className="data-[state=active]:bg-background"
                >
                  Absences
                </TabsTrigger>
              </TabsList>
            </div>

            <Card className="p-6">{tabContent}</Card>
          </Tabs>
        </ErrorBoundary>
      </div>
    </SchedulingContext.Provider>
  );
}
