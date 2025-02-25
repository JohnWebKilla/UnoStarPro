"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
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
