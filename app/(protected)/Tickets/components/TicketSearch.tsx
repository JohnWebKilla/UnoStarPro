"use client";

import { useState, useEffect } from "react";
import { Search, X, Check, ChevronsUpDown, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

interface TicketSearchProps {
  onSearch: (filters: TicketFilters) => void;
}

interface TicketFilters {
  dateRange: DateRange | undefined;
  status: string;
  company?: string;
  driver?: string;
}

// Mock data - replace with your actual data source
const DRIVERS = [
  { value: "driver1", label: "John Driver" },
  { value: "driver2", label: "Jane Driver" },
  { value: "driver3", label: "Bob Driver" },
];

const COMPANIES = [
  { value: "company1", label: "Acme Corp" },
  { value: "company2", label: "Globex Corp" },
  { value: "company3", label: "Initech" },
];

export function TicketSearch({ onSearch }: TicketSearchProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>({
    dateRange: undefined,
    status: "",
    company: "",
    driver: "",
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [driverPopoverOpen, setDriverPopoverOpen] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredDrivers = DRIVERS.filter((driver) =>
    driver.label.toLowerCase().includes(driverSearch.toLowerCase())
  );

  const filteredCompanies = COMPANIES.filter((company) =>
    company.label.toLowerCase().includes(companySearch.toLowerCase())
  );

  const handleSearch = () => {
    const newActiveFilters: string[] = [];
    if (filters.dateRange?.from && filters.dateRange?.to)
      newActiveFilters.push("Date range");
    if (filters.status) newActiveFilters.push("Status");
    if (filters.company) newActiveFilters.push("Company");
    if (filters.driver) newActiveFilters.push("Driver");

    setActiveFilters(newActiveFilters);
    onSearch({
      dateRange: filters.dateRange,
      status: filters.status || "",
      company: filters.company || "",
      driver: filters.driver || "",
    });
    setOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters: TicketFilters = {
      dateRange: undefined,
      status: "",
      company: "",
      driver: "",
    };

    setFilters(emptyFilters);
    setActiveFilters([]);
    onSearch(emptyFilters);
  };

  const handleDriverSelect =
    (driver: (typeof DRIVERS)[0]) => (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event from bubbling up
      setFilters((prev) => ({
        ...prev,
        driver: driver.value === filters.driver ? "" : driver.value,
      }));
      setDriverPopoverOpen(false);
      setDriverSearch("");
    };

  const handleCompanySelect =
    (company: (typeof COMPANIES)[0]) => (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event from bubbling up
      setFilters((prev) => ({
        ...prev,
        company: company.value === filters.company ? "" : company.value,
      }));
      setCompanyPopoverOpen(false);
      setCompanySearch("");
    };

  return (
    <div className="flex items-center gap-2">
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-1">
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary">
              {filter}
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              ⌘S
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Search Tickets</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Driver Select */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Driver</label>
              <Popover
                open={driverPopoverOpen}
                onOpenChange={setDriverPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={driverPopoverOpen}
                    className="w-full justify-between"
                  >
                    {filters.driver
                      ? DRIVERS.find((d) => d.value === filters.driver)?.label
                      : "Select driver..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search drivers..."
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredDrivers.map((driver) => (
                        <div
                          key={driver.value}
                          className={cn(
                            "flex items-center px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm",
                            filters.driver === driver.value && "bg-accent"
                          )}
                          onClick={handleDriverSelect(driver)}
                          role="button"
                          tabIndex={0}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.driver === driver.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {driver.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Company Select - Similar structure to Driver Select */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Company</label>
              <Popover
                open={companyPopoverOpen}
                onOpenChange={setCompanyPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={companyPopoverOpen}
                    className="w-full justify-between"
                  >
                    {filters.company
                      ? COMPANIES.find((c) => c.value === filters.company)
                          ?.label
                      : "Select company..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search companies..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredCompanies.map((company) => (
                        <div
                          key={company.value}
                          className={cn(
                            "flex items-center px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm",
                            filters.company === company.value && "bg-accent"
                          )}
                          onClick={handleCompanySelect(company)}
                          role="button"
                          tabIndex={0}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.company === company.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {company.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? (
                      filters.dateRange.to ? (
                        <>
                          {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                          {format(filters.dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(filters.dateRange.from, "LLL dd, y")
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
                    defaultMonth={filters.dateRange?.from}
                    selected={filters.dateRange}
                    onSelect={(date) => {
                      setFilters((prev) => ({ ...prev, dateRange: date }));
                      if (date?.from && date?.to) {
                        setDatePickerOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="notified">Notified</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
