import { AlertCircle, CheckCircle, Loader2, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardsProps {
  openTickets: number;
  closedTickets: number;
  inProgressTickets: number;
  notifiedTickets: number;
  activeFilter: string | null;
  onFilterChange: (status: string | null) => void;
  showTotalCounts?: boolean;
}

export function StatusCards({
  openTickets,
  closedTickets,
  inProgressTickets,
  notifiedTickets,
  activeFilter,
  onFilterChange,
  showTotalCounts = false,
}: StatusCardsProps) {
  const handleClick = (status: string) => {
    onFilterChange(activeFilter === status ? null : status);
  };

  const getCount = (status: string, count: number) => {
    if (showTotalCounts) return count;
    return activeFilter === null || activeFilter === status ? count : 0;
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <div
        onClick={() => handleClick("open")}
        className={cn(
          "bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700",
          "cursor-pointer hover:border-red-500/50 transition-colors",
          activeFilter === "open" &&
            "border-red-500 bg-red-50 dark:bg-red-900/20"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="text-red-500 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Open:
            </span>
            <span className="text-sm font-semibold">
              {getCount("open", openTickets)}
            </span>
          </div>
        </div>
      </div>

      <div
        onClick={() => handleClick("in progress")}
        className={cn(
          "bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700",
          "cursor-pointer hover:border-orange-500/50 transition-colors",
          activeFilter === "in progress" &&
            "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="text-orange-500 dark:text-orange-400">
            <Loader2 className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              In Progress:
            </span>
            <span className="text-sm font-semibold">
              {getCount("in progress", inProgressTickets)}
            </span>
          </div>
        </div>
      </div>

      <div
        onClick={() => handleClick("closed")}
        className={cn(
          "bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700",
          "cursor-pointer hover:border-green-500/50 transition-colors",
          activeFilter === "closed" &&
            "border-green-500 bg-green-50 dark:bg-green-900/20"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="text-green-500 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Closed:
            </span>
            <span className="text-sm font-semibold">
              {getCount("closed", closedTickets)}
            </span>
          </div>
        </div>
      </div>

      <div
        onClick={() => handleClick("notified")}
        className={cn(
          "bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700",
          "cursor-pointer hover:border-blue-500/50 transition-colors",
          activeFilter === "notified" &&
            "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="text-blue-500 dark:text-blue-400">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Notified:
            </span>
            <span className="text-sm font-semibold">
              {getCount("notified", notifiedTickets)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
