"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfWeek, addDays } from "date-fns";

interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  date: string;
  user: {
    first_name: string;
    last_name: string;
  };
}

export function ShiftSchedule() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("shifts")
        .select(
          `
          *,
          user:users(first_name, last_name)
        `
        )
        .order("date", { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      console.error("Error fetching shifts:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading schedule...</div>;
  }

  // Get the start of the current week
  const weekStart = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            {weekDays.map((day) => (
              <TableHead key={day.toISOString()}>
                {format(day, "EEE MM/dd")}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift.id}>
              <TableCell className="font-medium">
                {shift.user.first_name} {shift.user.last_name}
              </TableCell>
              {weekDays.map((day) => (
                <TableCell key={day.toISOString()}>
                  {format(new Date(shift.date), "yyyy-MM-dd") ===
                  format(day, "yyyy-MM-dd")
                    ? `${format(new Date(shift.start_time), "HH:mm")} - 
                       ${format(new Date(shift.end_time), "HH:mm")}`
                    : "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
