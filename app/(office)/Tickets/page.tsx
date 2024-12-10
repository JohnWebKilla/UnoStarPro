"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { DriverSearch } from "./components/SearchBar";
import { AlertCircle, CheckCircle, Loader2, Bell, Check } from "lucide-react";

interface Ticket {
  id: number;
  title: string;
  description: string;
  date: Date;
  status: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<"tickets" | "managerCheck">(
    "tickets"
  );

  useEffect(() => {
    const fetchedTickets: Ticket[] = [
      {
        id: 1,
        title: "Ticket 1",
        description: "This is the description for Ticket 1",
        date: new Date(2023, 4, 15), // May 15, 2023
        status: "Open",
      },
      {
        id: 2,
        title: "Ticket 2",
        description: "This is the description for Ticket 2",
        date: new Date(2023, 3, 20), // April 20, 2023
        status: "Closed",
      },
      {
        id: 3,
        title: "Ticket 3",
        description: "This is the description for Ticket 3",
        date: new Date(2023, 4, 10), // May 10, 2023
        status: "In Progress",
      },
    ];
    setTickets(fetchedTickets);
    setFilteredTickets(fetchedTickets);
  }, []);

  const handleSearch = (startDate: Date | null, endDate: Date | null) => {
    const filtered = tickets.filter((ticket) => {
      if (startDate && endDate) {
        return ticket.date >= startDate && ticket.date <= endDate;
      } else {
        return true; // Return all tickets if start or end date is null
      }
    });
    setFilteredTickets(filtered);
  };

  // Calculate ticket counts by status
  const openTickets = filteredTickets.filter(
    (ticket) => ticket.status === "Open"
  ).length;
  const closedTickets = filteredTickets.filter(
    (ticket) => ticket.status === "Closed"
  ).length;
  const inProgressTickets = filteredTickets.filter(
    (ticket) => ticket.status === "In Progress"
  ).length;
  const notifiedTickets = filteredTickets.filter(
    (ticket) => ticket.status === "Notified"
  ).length;
  const confirmedTickets = filteredTickets.filter(
    (ticket) => ticket.status === "Confirmed"
  ).length;

  return (
    <div className="w-full mt-4 px-4">
      {/* Ticket counts */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-md p-4 flex items-center border border-gray-300 dark:border-gray-700">
          <span className="text-red-500 dark:text-red-400 mr-2 border-l-8 border-red-500 dark:border-red-400 pl-2">
            <AlertCircle size={20} />
          </span>
          <span className="font-semibold">Open: {openTickets}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-md p-4 flex items-center border border-gray-300 dark:border-gray-700">
          <span className="text-green-500 dark:text-green-400 mr-2 border-l-8 border-green-500 dark:border-green-400 pl-2">
            <CheckCircle size={20} />
          </span>
          <span className="font-semibold">Closed: {closedTickets}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-md p-4 flex items-center border border-gray-300 dark:border-gray-700">
          <span className="text-orange-500 dark:text-orange-400 mr-2 border-l-8 border-orange-500 dark:border-orange-400 pl-2">
            <Loader2 size={20} />
          </span>
          <span className="font-semibold">
            In Progress: {inProgressTickets}
          </span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-md p-4 flex items-center border border-gray-300 dark:border-gray-700">
          <span className="text-blue-500 dark:text-blue-400 mr-2 border-l-8 border-blue-500 dark:border-blue-400 pl-2">
            <Bell size={20} />
          </span>
          <span className="font-semibold">Notified: {notifiedTickets}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-md p-4 flex items-center border border-gray-300 dark:border-gray-700">
          <span className="text-gray-500 dark:text-gray-400 mr-2 border-l-8 border-gray-500 dark:border-gray-400 pl-2">
            <Check size={20} />
          </span>
          <span className="font-semibold">Confirmed: {confirmedTickets}</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex mb-4">
        <button
          className={`px-4 py-2 rounded-l-md ${
            activeTab === "tickets"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
          onClick={() => setActiveTab("tickets")}
        >
          Tickets
        </button>
        <button
          className={`px-4 py-2 rounded-r-md ${
            activeTab === "managerCheck"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
          onClick={() => setActiveTab("managerCheck")}
        >
          Manager Check
        </button>
      </div>

      {activeTab === "tickets" && (
        <>
          <div className="w-full mt-4">
            <DataTable columns={columns} data={filteredTickets} />
          </div>
        </>
      )}

      {activeTab === "managerCheck" && (
        <div>
          {/* Add your Manager Check component or content here */}
          <p>This is the Manager Check section.</p>
        </div>
      )}
    </div>
  );
}
