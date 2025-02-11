import { AlertCircle, CheckCircle, Loader2, Bell, Check } from "lucide-react";

interface StatusCardsProps {
  openTickets: number;
  closedTickets: number;
  inProgressTickets: number;
  notifiedTickets: number;
  confirmedTickets: number;
}

export function StatusCards({
  openTickets,
  closedTickets,
  inProgressTickets,
  notifiedTickets,
  confirmedTickets,
}: StatusCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-300 dark:border-gray-700">
        <span className="text-red-500 dark:text-red-400 mr-2 border-l-4 border-red-500 dark:border-red-400 pl-2">
          <AlertCircle size={16} />
        </span>
        <span className="text-sm font-medium">Open: {openTickets}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-300 dark:border-gray-700">
        <span className="text-green-500 dark:text-green-400 mr-2 border-l-4 border-green-500 dark:border-green-400 pl-2">
          <CheckCircle size={16} />
        </span>
        <span className="text-sm font-medium">Closed: {closedTickets}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-300 dark:border-gray-700">
        <span className="text-orange-500 dark:text-orange-400 mr-2 border-l-4 border-orange-500 dark:border-orange-400 pl-2">
          <Loader2 size={16} />
        </span>
        <span className="text-sm font-medium">
          In Progress: {inProgressTickets}
        </span>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-300 dark:border-gray-700">
        <span className="text-blue-500 dark:text-blue-400 mr-2 border-l-4 border-blue-500 dark:border-blue-400 pl-2">
          <Bell size={16} />
        </span>
        <span className="text-sm font-medium">Notified: {notifiedTickets}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-md py-2 px-3 flex items-center border border-gray-300 dark:border-gray-700">
        <span className="text-gray-500 dark:text-gray-400 mr-2 border-l-4 border-gray-500 dark:border-gray-400 pl-2">
          <Check size={16} />
        </span>
        <span className="text-sm font-medium">
          Confirmed: {confirmedTickets}
        </span>
      </div>
    </div>
  );
}
