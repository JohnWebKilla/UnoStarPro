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
import { Badge } from "@/components/ui/badge";

interface ScheduleResponse {
  id: number;
  user_id: string;
  working_shift: string;
  off_days: string[];
  users: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface Schedule {
  id: number;
  user_id: string;
  working_shift: string;
  off_days: string[];
  first_name: string;
  last_name: string;
  role: string;
}

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface Props {
  className?: string;
}

const ShiftSchedule: React.FC<Props> = ({ className }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .order("id");

      if (shiftsError) throw shiftsError;
      setShifts(shiftsData || []);

      // Fetch schedules with user data
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("schedules")
        .select(
          `
          id,
          user_id,
          working_shift,
          off_days,
          users (
            first_name,
            last_name,
            role
          )
        `
        )
        .eq("users.role", "user")
        .returns<ScheduleResponse[]>();

      if (schedulesError) throw schedulesError;

      // Transform the data to match our interface
      const transformedData = schedulesData?.map((schedule) => ({
        id: schedule.id,
        user_id: schedule.user_id,
        working_shift: schedule.working_shift,
        off_days: schedule.off_days,
        first_name: schedule.users.first_name,
        last_name: schedule.users.last_name,
        role: schedule.users.role,
      }));

      setSchedules(transformedData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error.message);
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

  const getShiftTimes = (shiftId: string) => {
    const shift = shifts.find((s) => s.id.toString() === shiftId);
    return shift ? `${shift.start_time} - ${shift.end_time}` : "No shift";
  };

  const isOffDay = (schedule: Schedule, date: Date) => {
    const dayName = format(date, "EEEE").toLowerCase();
    return schedule.off_days?.includes(dayName);
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex gap-4 mb-4">
        {shifts.map((shift) => (
          <div key={shift.id} className="flex items-center gap-2">
            <Badge variant="outline">
              {shift.name}: {shift.start_time} - {shift.end_time}
            </Badge>
          </div>
        ))}
      </div>

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
          {schedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell className="font-medium">
                {schedule.first_name} {schedule.last_name}
              </TableCell>
              {weekDays.map((day) => (
                <TableCell
                  key={day.toISOString()}
                  className={isOffDay(schedule, day) ? "bg-gray-100" : ""}
                >
                  {isOffDay(schedule, day) ? (
                    <Badge variant="secondary">Off Day</Badge>
                  ) : (
                    getShiftTimes(schedule.working_shift)
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ShiftSchedule;
