"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { StatusCards } from "./components/StatusCards";
import { Chat } from "./components/Chat";
import { TicketSearch } from "./components/TicketSearch";
import { DateRange } from "react-day-picker";

interface Ticket {
  id: number;
  timestamp: Date;
  company: string;
  driver: string;
  services: string;
  dispatcher: string;
  dispatchNote: string;
  editor: string;
  editorNote: string;
  managerNote: string;
  duration: string;
  status: string;
  joinedAt?: Date;
  closedAt?: Date;
  notifiedAt?: Date;
  confirmedAt?: Date;
  beforePdf?: string;
  afterPdf?: string;
}

interface TicketFilters {
  dateRange: DateRange | undefined;
  status: string;
  company?: string;
  driver?: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);

  // Mock current user - replace with your actual user data/auth
  const currentUser = {
    id: "You",
    name: "Current User",
    image: undefined,
  };

  useEffect(() => {
    const fetchedTickets = [
      {
        id: 1,
        timestamp: new Date("2024-02-11T15:00:19"),
        company: "TR LINES INC",
        driver: "Azim Kosimov",
        services: "New Shift",
        dispatcher: "Shaxzod Nosirov",
        dispatchNote: "Driver assigned and briefed about the route",
        editor: "Samandar Muinov",
        editorNote: "Documentation verified and processed",
        managerNote: "Priority delivery, handle with care",
        duration: "7m",
        status: "In Progress",
        joinedAt: new Date("2024-02-11T15:01:19"),
        closedAt: new Date("2024-02-11T15:30:19"),
        notifiedAt: new Date("2024-02-11T15:31:19"),
        confirmedAt: new Date("2024-02-11T15:35:19"),
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
      {
        id: 2,
        timestamp: new Date("2024-02-11T15:00:32"),
        company: "TR LINES INC",
        driver: "Komil Ismoilov",
        services: "New Shift",
        dispatcher: "Parviz Erkinov",
        dispatchNote: "Note",
        editor: "Samandar Saidov",
        editorNote: "",
        managerNote: "Priority delivery, handle with care",
        duration: "7m",
        status: "In Progress",
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
      {
        id: 3,
        timestamp: new Date("2024-02-11T15:02:27"),
        company: "LION CARGO",
        driver: "Irakli Rizhamadze",
        services: "Extra-Hrs",
        dispatcher: "Shaxzod Nosirov",
        dispatchNote: "Note",
        editor: "Damir Rustamov",
        editorNote: "",
        managerNote: "Priority delivery, handle with care",
        duration: "6m",
        status: "In Progress",
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
      {
        id: 4,
        timestamp: new Date("2024-02-11T15:05:38"),
        company: "US ROAD",
        driver: "Kakha Aladashvili",
        services: "New Shift",
        dispatcher: "Parviz Erkinov",
        dispatchNote: "",
        editor: "Shaxrizod Mamadjanov",
        editorNote: "",
        managerNote: "Priority delivery, handle with care",
        duration: "3m",
        status: "In Progress",
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
    ];
    setTickets(fetchedTickets);
    setFilteredTickets(fetchedTickets);
  }, []);

  const handleTicketSearch = (filters: TicketFilters) => {
    const filtered = tickets.filter((ticket) => {
      let matches = true;

      // Date range
      if (filters.dateRange?.from && filters.dateRange?.to) {
        matches =
          matches &&
          ticket.timestamp >= filters.dateRange.from &&
          ticket.timestamp <= filters.dateRange.to;
      }

      // Status
      if (filters.status) {
        matches =
          matches &&
          ticket.status.toLowerCase() === filters.status.toLowerCase();
      }

      // Company
      if (filters.company) {
        matches =
          matches &&
          ticket.company.toLowerCase().includes(filters.company.toLowerCase());
      }

      // Driver
      if (filters.driver) {
        matches =
          matches &&
          ticket.driver.toLowerCase().includes(filters.driver.toLowerCase());
      }

      return matches;
    });

    setFilteredTickets(filtered);
  };

  // Calculate ticket counts by status
  const openTickets = filteredTickets.filter(
    (ticket) => ticket.status.toLowerCase() === "open"
  ).length;
  const closedTickets = filteredTickets.filter(
    (ticket) => ticket.status.toLowerCase() === "closed"
  ).length;
  const inProgressTickets = filteredTickets.filter(
    (ticket) => ticket.status.toLowerCase() === "in progress"
  ).length;
  const notifiedTickets = filteredTickets.filter(
    (ticket) => ticket.status.toLowerCase() === "notified"
  ).length;
  const confirmedTickets = filteredTickets.filter(
    (ticket) => ticket.status.toLowerCase() === "confirmed"
  ).length;

  return (
    <div className="w-full h-[calc(100vh-100px)]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1">
          <StatusCards
            openTickets={openTickets}
            closedTickets={closedTickets}
            inProgressTickets={inProgressTickets}
            notifiedTickets={notifiedTickets}
            confirmedTickets={confirmedTickets}
          />
        </div>
        <div className="ml-4">
          <TicketSearch onSearch={handleTicketSearch} />
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-150px)]">
        <div className="flex-[3] overflow-auto">
          <DataTable columns={columns} data={filteredTickets} />
        </div>
        <div className="flex-1 min-w-[400px] max-w-[500px]">
          <Chat userRole="admin" currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}
