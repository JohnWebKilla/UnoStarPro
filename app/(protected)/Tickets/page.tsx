"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { StatusCards } from "./components/StatusCards";
import { Chat } from "./components/Chat";
import { TicketSearch } from "./components/TicketSearch";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { MagnifyingGlassIcon, Cross2Icon } from "@radix-ui/react-icons";
import { AddTicket } from "./components/AddTicket";
import { AddSystemIssue } from "./components/AddSystemIssue";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { IssuesTable } from "./components/IssuesTable";
import { BugIcon } from "lucide-react";
import { TicketIcon } from "lucide-react";
import { Toaster } from "sonner";
import { mockIssues } from "./components/IssuesTable";

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
  dateRange?: {
    from: Date;
    to: Date;
  };
  status: string;
  company?: string;
  driver?: string;
}

interface SystemIssue {
  id: string;
  timestamp: Date;
  company: string;
  driver: string;
  systemType: "android" | "ios" | "web";
  description: string;
  status: "open" | "in progress" | "resolved";
  files: {
    name: string;
    url: string;
  }[];
}

// Add mock data or fetch from your API
const mockCompanies = [
  { id: "1", name: "Company A" },
  { id: "2", name: "Company B" },
  { id: "3", name: "Company C" },
];

const mockDrivers = [
  { id: "1", name: "Driver 1", companyId: "1" },
  { id: "2", name: "Driver 2", companyId: "1" },
  { id: "3", name: "Driver 3", companyId: "2" },
  { id: "4", name: "Driver 4", companyId: "2" },
  { id: "5", name: "Driver 5", companyId: "3" },
];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const [issues, setIssues] = useState<SystemIssue[]>(mockIssues);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [issueStatusFilter, setIssueStatusFilter] = useState<string | null>(
    null
  );

  // Mock current user - replace with your actual user data/auth
  const currentUser = {
    id: "You",
    name: "Current User",
    image: undefined,
  };

  useEffect(() => {
    const fetchedTickets = [
      // Original tickets with both PDFs
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
        status: "Closed",
        joinedAt: new Date("2024-02-11T15:01:19"),
        closedAt: new Date("2024-02-11T15:30:19"),
        notifiedAt: new Date("2024-02-11T15:31:19"),
        confirmedAt: new Date("2024-02-11T15:35:19"),
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
      // In Progress tickets with only beforePdf
      {
        id: 2,
        timestamp: new Date("2024-02-11T15:00:32"),
        company: "TR LINES INC",
        driver: "Komil Ismoilov",
        services: "New Shift",
        dispatcher: "Parviz Erkinov",
        dispatchNote: "Route optimization required",
        editor: "Samandar Saidov",
        editorNote: "",
        managerNote: "Check ETA updates",
        duration: "15m",
        status: "In Progress",
        joinedAt: new Date("2024-02-11T15:02:00"),
        beforePdf: "/path/to/before.pdf",
      },
      {
        id: 3,
        timestamp: new Date("2024-02-11T15:02:27"),
        company: "LION CARGO",
        driver: "Irakli Rizhamadze",
        services: "Extra-Hrs",
        dispatcher: "Shaxzod Nosirov",
        dispatchNote: "Additional stops added",
        editor: "Damir Rustamov",
        editorNote: "",
        managerNote: "Monitor overtime",
        duration: "22m",
        status: "In Progress",
        joinedAt: new Date("2024-02-11T15:03:00"),
        beforePdf: "/path/to/before.pdf",
      },
      // More tickets with varying states
      {
        id: 4,
        timestamp: new Date("2024-02-11T15:05:38"),
        company: "US ROAD",
        driver: "Kakha Aladashvili",
        services: "New Shift",
        dispatcher: "Parviz Erkinov",
        dispatchNote: "Express delivery",
        editor: "Shaxrizod Mamadjanov",
        editorNote: "Updated delivery instructions",
        managerNote: "High priority client",
        duration: "5m",
        status: "Notified",
        joinedAt: new Date("2024-02-11T15:06:00"),
        closedAt: new Date("2024-02-11T15:10:00"),
        notifiedAt: new Date("2024-02-11T15:11:00"),
        beforePdf: "/path/to/before.pdf",
        afterPdf: "/path/to/after.pdf",
      },
      {
        id: 5,
        timestamp: new Date("2024-02-11T14:30:00"),
        company: "SWIFT LOGISTICS",
        driver: "David Chen",
        services: "Regular",
        dispatcher: "Sarah Johnson",
        dispatchNote: "Standard route",
        editor: "",
        editorNote: "",
        managerNote: "",
        duration: "3m",
        status: "Created",
        beforePdf: "/path/to/before.pdf",
      },
      // Add 10 more tickets with varying states
      ...[...Array(10)].map((_, index) => ({
        id: index + 6,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        company: [
          "FAST TRACK",
          "CARGO PLUS",
          "SPEED WAY",
          "ROAD KINGS",
          "AIR CARGO",
        ][Math.floor(Math.random() * 5)],
        driver: [
          "John Smith",
          "Mike Johnson",
          "Alex Brown",
          "Chris Davis",
          "Tom Wilson",
        ][Math.floor(Math.random() * 5)],
        services: ["New Shift", "Extra-Hrs", "Regular"][
          Math.floor(Math.random() * 3)
        ],
        dispatcher: ["Emma White", "James Black", "Lisa Green"][
          Math.floor(Math.random() * 3)
        ],
        dispatchNote: Math.random() > 0.5 ? "Route note " + (index + 6) : "",
        editor: ["Mark Editor", "Jane Editor", "Paul Editor"][
          Math.floor(Math.random() * 3)
        ],
        editorNote: Math.random() > 0.5 ? "Edit note " + (index + 6) : "",
        managerNote:
          Math.random() > 0.5 ? "Management note " + (index + 6) : "",
        duration: `${Math.floor(Math.random() * 30)}m`,
        status: ["Created", "In Progress", "Closed", "Notified", "Confirmed"][
          Math.floor(Math.random() * 5)
        ],
        joinedAt:
          Math.random() > 0.3
            ? new Date(Date.now() - Math.random() * 86400000)
            : undefined,
        closedAt:
          Math.random() > 0.6
            ? new Date(Date.now() - Math.random() * 43200000)
            : undefined,
        notifiedAt:
          Math.random() > 0.7
            ? new Date(Date.now() - Math.random() * 21600000)
            : undefined,
        confirmedAt:
          Math.random() > 0.8
            ? new Date(Date.now() - Math.random() * 10800000)
            : undefined,
        beforePdf: "/path/to/before.pdf",
        afterPdf: Math.random() > 0.5 ? "/path/to/after.pdf" : undefined,
      })),
    ];

    setTickets(fetchedTickets);
    setFilteredTickets(fetchedTickets);
  }, []);

  useEffect(() => {
    if (statusFilter) {
      const filtered = tickets.filter(
        (ticket) => ticket.status.toLowerCase() === statusFilter.toLowerCase()
      );
      setFilteredTickets(filtered);
      setIsFiltered(true);
    } else {
      setFilteredTickets(tickets);
      setIsFiltered(false);
    }
  }, [statusFilter, tickets]);

  const handleTicketSearch = (filters: TicketFilters) => {
    const filtered = tickets.filter((ticket) => {
      let matches = true;

      // Date range
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const ticketDate = new Date(ticket.timestamp);
        // Set time to start of day for consistent comparison
        const fromDate = new Date(filters.dateRange.from);
        const toDate = new Date(filters.dateRange.to);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        matches = matches && ticketDate >= fromDate && ticketDate <= toDate;
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
    setIsFiltered(true);
  };

  const handleClearFilters = () => {
    setFilteredTickets(tickets);
    setIsFiltered(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isFiltered) {
          handleClearFilters();
        } else {
          setSearchDialogOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFiltered]);

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

  // Modify the issues filtering effect
  useEffect(() => {
    if (issueStatusFilter) {
      // Map the filter status to match the actual status values
      const statusMap: Record<string, string> = {
        open: "open",
        "in progress": "in progress",
        closed: "resolved", // Map 'closed' filter to 'resolved' status
        notified: "notified",
      };

      const mappedStatus = statusMap[issueStatusFilter.toLowerCase()];
      const filtered = mockIssues.filter(
        (issue) => issue.status.toLowerCase() === mappedStatus
      );
      setIssues(filtered);
    } else {
      setIssues(mockIssues); // Reset to all mock issues when no filter
    }
  }, [issueStatusFilter]);

  return (
    <>
      <Toaster position="top-right" />
      <div className="w-full h-[calc(100vh-100px)]">
        <Tabs defaultValue="tickets" className="w-full">
          <TabsContent value="tickets" className="mt-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <TabsList>
                    <TabsTrigger value="tickets">
                      <TicketIcon className="mr-2 h-4 w-4" />
                      Tickets
                    </TabsTrigger>
                    <TabsTrigger value="issues">
                      <BugIcon className="mr-2 h-4 w-4" />
                      Bugs
                    </TabsTrigger>
                  </TabsList>
                  <StatusCards
                    openTickets={openTickets}
                    closedTickets={closedTickets}
                    inProgressTickets={inProgressTickets}
                    notifiedTickets={notifiedTickets}
                    activeFilter={statusFilter}
                    onFilterChange={setStatusFilter}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {isFiltered ? (
                    <Button
                      variant="outline"
                      onClick={handleClearFilters}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Cross2Icon className="mr-2 h-4 w-4" />
                      Clear Filters
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setSearchDialogOpen(true)}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <MagnifyingGlassIcon className="mr-2 h-4 w-4" />
                      Search Tickets
                    </Button>
                  )}
                  <AddTicket
                    onAddTicket={(newTicket) => {
                      setTickets((prev) => [newTicket, ...prev]);
                      setFilteredTickets((prev) => [newTicket, ...prev]);
                    }}
                  />
                  <TicketSearch
                    tickets={tickets}
                    onSearch={handleTicketSearch}
                    open={searchDialogOpen}
                    onOpenChange={setSearchDialogOpen}
                  />
                </div>
              </div>

              <div className="flex gap-4 h-[calc(100vh-140px)]">
                <div className="flex-[3] overflow-auto rounded-lg border">
                  <DataTable columns={columns} data={filteredTickets} />
                </div>
                <div className="flex-1 min-w-[400px] max-w-[500px] rounded-lg border">
                  <Chat userRole="admin" currentUser={currentUser} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="mt-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <TabsList>
                    <TabsTrigger value="tickets">
                      <TicketIcon className="mr-2 h-4 w-4" />
                      Tickets
                    </TabsTrigger>
                    <TabsTrigger value="issues">
                      <BugIcon className="mr-2 h-4 w-4" />
                      Bugs
                    </TabsTrigger>
                  </TabsList>
                  <StatusCards
                    openTickets={
                      mockIssues.filter((i) => i.status === "open").length
                    }
                    inProgressTickets={
                      mockIssues.filter((i) => i.status === "in progress")
                        .length
                    }
                    closedTickets={
                      mockIssues.filter((i) => i.status === "resolved").length
                    }
                    notifiedTickets={0}
                    activeFilter={issueStatusFilter}
                    onFilterChange={setIssueStatusFilter}
                    showTotalCounts
                  />
                </div>
                <div className="flex items-center gap-2">
                  <AddSystemIssue
                    onAddIssue={(issue) => {
                      const newIssue: SystemIssue = {
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        company: issue.company,
                        driver: issue.driver,
                        systemType: issue.systemType,
                        description: issue.description,
                        status: "open",
                        files: issue.files.map((file) => ({
                          name: file.name,
                          url: URL.createObjectURL(file),
                        })),
                      };
                      setIssues((prev) => [newIssue, ...prev]);
                    }}
                    companies={mockCompanies}
                    drivers={mockDrivers}
                  />
                </div>
              </div>

              <div className="flex gap-4 h-[calc(100vh-140px)]">
                <div className="flex-[3] overflow-auto rounded-lg border">
                  <IssuesTable issues={issues} />
                </div>
                <div className="flex-1 min-w-[400px] max-w-[500px] rounded-lg border">
                  <Chat userRole="admin" currentUser={currentUser} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
