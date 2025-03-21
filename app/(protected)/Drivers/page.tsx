"use client";

import React from "react";
import { DriversTable } from "./components/DriversTable";
import { DriversHeader } from "./components/DriversHeader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DriversProvider } from "./components/DriversProvider";
import { DriversSkeleton } from "./components/DriversSkeleton";

export default function DriversPage() {
  return (
    <ErrorBoundary>
      <DriversProvider>
        <div className="p-6 space-y-6 animate-in fade-in-50 duration-500">
          <DriversHeader />
          <React.Suspense fallback={<DriversSkeleton />}>
            <DriversTable />
          </React.Suspense>
        </div>
      </DriversProvider>
    </ErrorBoundary>
  );
}
