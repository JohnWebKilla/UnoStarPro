"use client";

import React from "react";
import { useDrivers } from "./DriversProvider";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProgressIndicator() {
  const { progressUpdate, setProgressUpdate } = useDrivers();

  if (!progressUpdate.isVisible) return null;

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const progressPercentage = Math.round(
    (progressUpdate.completed / progressUpdate.total) * 100
  );

  const handleClose = () => {
    setProgressUpdate({ isVisible: false });
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 flex items-center gap-3 rounded-lg bg-white p-4 shadow-lg",
        "border border-gray-200 transition-all duration-200 ease-in-out",
        "animate-in slide-in-from-bottom-2"
      )}
    >
      <div className="flex items-center gap-2">
        {icons[progressUpdate.type]}
        <span className="text-sm font-medium text-gray-700">
          {progressUpdate.message}
        </span>
      </div>
      {progressUpdate.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-200 ease-in-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-500">{progressPercentage}%</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 h-8 w-8 p-0"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
