import { AlertCircle, CheckCircle, Loader2, Bell } from "lucide-react";

interface StatusCardsProps {
  openTickets: number;
  closedTickets: number;
  inProgressTickets: number;
  notifiedTickets: number;
}

export function StatusCards({
  openTickets,
  closedTickets,
  inProgressTickets,
  notifiedTickets,
}: StatusCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="text-red-500 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Open:
            </span>
            <span className="text-sm font-semibold">{openTickets}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="text-green-500 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Closed:
            </span>
            <span className="text-sm font-semibold">{closedTickets}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="text-orange-500 dark:text-orange-400">
            <Loader2 className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              In Progress:
            </span>
            <span className="text-sm font-semibold">{inProgressTickets}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="text-blue-500 dark:text-blue-400">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Notified:
            </span>
            <span className="text-sm font-semibold">{notifiedTickets}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
