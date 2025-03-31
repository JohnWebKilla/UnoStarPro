"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import CachedShiftSchedule from "./components/cached-shift-schedule";

// Create a client with appropriate stale time
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
        <CachedShiftSchedule />
      </div>
    </QueryClientProvider>
  );
}
