"use client";

import { PerformanceMetrics } from "./components/performance-metrics";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-10">
      <ErrorBoundary>
        <Card className="p-6">
          <PerformanceMetrics />
        </Card>
      </ErrorBoundary>
    </div>
  );
}
