"use client";

import { ShiftSchedule } from "./components/shift-schedule";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";

export default function SchedulePage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Shift Schedule</h1>
        <p className="text-muted-foreground mt-2">
          Manage and view your team's shift schedules
        </p>
      </div>

      <ErrorBoundary>
        <Card className="p-6">
          <ShiftSchedule />
        </Card>
      </ErrorBoundary>
    </div>
  );
}
