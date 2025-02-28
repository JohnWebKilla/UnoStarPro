"use client";

import * as React from "react";
import { format, addMonths, subMonths, setMonth, setYear } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthPickerProps {
  selected: Date;
  onMonthChange: (date: Date) => void;
  className?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthPicker({
  selected,
  onMonthChange,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [localDate, setLocalDate] = React.useState(selected);

  // Reset local date when selected date changes
  React.useEffect(() => {
    setLocalDate(selected);
  }, [selected]);

  const handlePreviousMonth = () => {
    onMonthChange(subMonths(selected, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selected, 1));
  };

  const handleMonthSelect = (monthIndex: string) => {
    const newDate = setMonth(localDate, parseInt(monthIndex));
    setLocalDate(newDate);
  };

  const handleYearSelect = (year: string) => {
    const newDate = setYear(localDate, parseInt(year));
    setLocalDate(newDate);
  };

  const handleApply = () => {
    onMonthChange(localDate);
    setOpen(false);
  };

  // Generate years (from 2020 to current year + 5)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2020 + 6 }, (_, i) =>
    (2020 + i).toString()
  );

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousMonth}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous month</span>
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[180px] justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(selected, "MMMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">Month</label>
                <Select
                  value={localDate.getMonth().toString()}
                  onValueChange={handleMonthSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={index.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">Year</label>
                <Select
                  value={localDate.getFullYear().toString()}
                  onValueChange={handleYearSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleApply} className="w-full">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        onClick={handleNextMonth}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next month</span>
      </Button>
    </div>
  );
}
