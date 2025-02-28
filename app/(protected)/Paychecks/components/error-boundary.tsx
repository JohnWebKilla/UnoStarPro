"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error("Error caught by boundary:", error);
      setHasError(true);
      setError(error.error);
    };

    window.addEventListener("error", errorHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <h2 className="text-xl font-bold">Something went wrong</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            An error occurred while loading the Paychecks page. Please try again
            or contact support if the problem persists.
          </p>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md mb-4 overflow-auto max-h-32">
              <p className="text-sm font-mono text-red-800 dark:text-red-300">
                {error.toString()}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setHasError(false);
                setError(null);
                window.location.reload();
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
