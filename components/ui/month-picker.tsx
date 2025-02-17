"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
  selected: Date;
  onMonthChange: (date: Date) => void;
  placeholder?: string;
}

export function MonthPicker({
  selected,
  onMonthChange,
  placeholder = "Select month",
}: MonthPickerProps) {
  const [currentDate, setCurrentDate] = React.useState(selected || new Date());

  const handlePreviousMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleSelect = (date: Date) => {
    onMonthChange(startOfMonth(date));
    const popover = document.querySelector(
      '[data-state="open"]'
    ) as HTMLElement;
    if (popover) {
      popover.click(); // Close the popover
    }
  };

  const quickSelectOptions = [
    {
      label: "Current Month",
      date: startOfMonth(new Date()),
    },
    {
      label: "Last Month",
      date: startOfMonth(subMonths(new Date(), 1)),
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn("w-[200px] justify-start text-left font-normal")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "MMMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Quick select options */}
          <div className="flex gap-2">
            {quickSelectOptions.map((option) => (
              <Button
                key={option.label}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSelect(option.date)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold">
              {format(currentDate, "MMMM yyyy")}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Select button */}
          <Button className="w-full" onClick={() => handleSelect(currentDate)}>
            Select {format(currentDate, "MMMM yyyy")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
