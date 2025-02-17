"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";

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
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              // Always set to first day of the month
              onMonthChange(startOfMonth(date));
            }
          }}
          initialFocus
          showOutsideDays={false}
          // Only show month picker
          defaultMonth={selected}
          ISOWeek
        />
      </PopoverContent>
    </Popover>
  );
}
