"use client";

import * as React from "react";
import { format, addMonths, subMonths } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";

interface MonthPickerProps {
  selected: Date;
  onMonthChange: (date: Date) => void;
  className?: string;
}

export function MonthPicker({
  selected,
  onMonthChange,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  const handlePreviousMonth = () => {
    onMonthChange(subMonths(selected, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selected, 1));
  };

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onMonthChange(date);
      setOpen(false);
    }
  };

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
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            initialFocus
            month={selected}
            onMonthChange={handleSelect}
            captionLayout="dropdown-buttons"
            fromMonth={new Date(2020, 0)}
            toMonth={new Date(2030, 11)}
          />
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
