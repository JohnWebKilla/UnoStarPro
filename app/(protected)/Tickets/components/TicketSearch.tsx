"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface TicketSearchProps {
  onSearch: (filters: any) => void;
  tickets?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketSearch({
  onSearch,
  tickets = [],
  open,
  onOpenChange,
}: TicketSearchProps) {
  const [driverValue, setDriverValue] = useState("all");
  const [companyValue, setCompanyValue] = useState("all");
  const [statusValue, setStatusValue] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Get unique companies
  const companies = Array.from(
    new Set(tickets?.map((ticket) => ticket.company) || [])
  );

  // Get drivers for selected company
  const drivers = Array.from(
    new Set(
      tickets
        ?.filter(
          (ticket) => companyValue === "all" || ticket.company === companyValue
        )
        .map((ticket) => ticket.driver) || []
    )
  );

  // Reset driver when company changes
  const handleCompanyChange = (value: string) => {
    setCompanyValue(value);
    setDriverValue("all"); // Reset to "all" instead of empty string
  };

  const statuses = [
    "Created",
    "In Progress",
    "Closed",
    "Notified",
    "Confirmed",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Search Tickets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Date Range Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Company Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Company</label>
            <Select value={companyValue} onValueChange={handleCompanyChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select company..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Driver Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Driver</label>
            <Select
              value={driverValue}
              onValueChange={setDriverValue}
              disabled={drivers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    drivers.length === 0
                      ? "Select a company first..."
                      : "Select driver..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver} value={driver}>
                    {driver}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search and Clear Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                // Only include dateRange if both from and to are selected
                const searchFilters = {
                  dateRange:
                    dateRange?.from && dateRange?.to ? dateRange : undefined,
                  company: companyValue === "all" ? "" : companyValue,
                  driver: driverValue === "all" ? "" : driverValue,
                  status: statusValue === "all" ? "" : statusValue,
                };
                onSearch(searchFilters);
                onOpenChange(false);
              }}
            >
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDateRange(undefined);
                setCompanyValue("all");
                setDriverValue("all");
                setStatusValue("all");
                onSearch({});
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
