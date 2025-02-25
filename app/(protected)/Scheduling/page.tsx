"use client";

import { Suspense } from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Users, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useSchedulingData } from "./hooks/useScheduling";
import ShiftSchedule from "./components/shift-schedule";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

// Dynamically import components with loading boundaries
const ScheduleManagement = dynamic(
  () => import("./components/schedule-management"),
  {
    loading: () => <Skeleton className="h-[500px] w-full" />,
    ssr: false,
  }
);

const AbsenceCalendar = dynamic(() => import("./components/AbsenceCalendar"), {
  loading: () => <Skeleton className="h-[500px] w-full" />,
  ssr: false,
});

// Stats Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  isLoading: boolean;
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
        ) : (
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        )}
      </div>
    </Card>
  );
}

// Stats Overview Component
function StatsOverview() {
  const { data, isLoading } = useSchedulingData();
  const stats = data?.stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <StatCard
        icon={Users}
        label="Total Employees"
        value={stats?.totalEmployees ?? 0}
        isLoading={isLoading}
      />
      <StatCard
        icon={Clock}
        label="Active Shifts"
        value={stats?.activeShifts ?? 0}
        isLoading={isLoading}
      />
      <StatCard
        icon={CalendarDays}
        label="Today's Absences"
        value={stats?.todayAbsences ?? 0}
        isLoading={isLoading}
      />
    </div>
  );
}

// Tab Content Component
function TabContent({ activeTab }: { activeTab: string }) {
  const Component = {
    schedule: ShiftSchedule,
    management: ScheduleManagement,
    absences: AbsenceCalendar,
  }[activeTab];

  if (!Component) return null;

  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

// Main Scheduling Page
function SchedulingContent() {
  const { data: schedulingData, isLoading } = useSchedulingData();

  const stats = schedulingData?.stats;
  const employees = schedulingData?.employees;
  const absences = schedulingData?.absences;

  return (
    <div className="py-8 space-y-8">
      <StatsOverview />

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedule">Shift Schedule</TabsTrigger>
          <TabsTrigger value="management">Schedule Management</TabsTrigger>
          <TabsTrigger value="absences">Absence Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <TabContent activeTab="schedule" />
        </TabsContent>
        <TabsContent value="management">
          <TabContent activeTab="management" />
        </TabsContent>
        <TabsContent value="absences">
          <TabContent activeTab="absences" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrap the page with QueryClientProvider
export default function SchedulingPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="py-2">
        <ShiftSchedule />
      </div>
    </QueryClientProvider>
  );
}
