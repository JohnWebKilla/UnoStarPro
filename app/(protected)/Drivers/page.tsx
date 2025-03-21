"use client";

import React from "react";
import { Suspense } from "react";
import { DriversTable } from "./components/DriversTable";
import { DriversHeader } from "./components/DriversHeader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DriversProvider } from "./components/DriversProvider";

export default function DriversPage() {
  return (
    <ErrorBoundary>
      <DriversProvider>
        <div className="p-6 space-y-6">
          <DriversHeader />
          <Suspense fallback={<div>Loading drivers...</div>}>
            <DriversTable />
          </Suspense>
        </div>
      </DriversProvider>
    </ErrorBoundary>
  );
}
