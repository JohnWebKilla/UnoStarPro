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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Database } from "@/types/supabase";

interface ScheduleResponse {
  id: number;
  user_id: string;
  working_shift: string;
  off_days: string;
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
  off_days: string;
  first_name: string;
  last_name: string;
  role: string;
}

type Absence = Database["public"]["Tables"]["absences"]["Row"];

interface Props {
  className?: string;
}

const ScheduleManagement: React.FC<Props> = ({ className }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [absenceReason, setAbsenceReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const shifts = [
    { id: 1, name: "Shift 1", start_time: "08:00", end_time: "16:00" },
    { id: 2, name: "Shift 2", start_time: "16:00", end_time: "00:00" },
    { id: 3, name: "Shift 3", start_time: "00:00", end_time: "08:00" },
  ];

  useEffect(() => {
    fetchSchedules();
    fetchAbsences();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await (
        await supabase
      )
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

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = data?.map((schedule) => ({
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
      console.error("Error fetching schedules:", error.message);
    }
  };

  const fetchAbsences = async () => {
    try {
      const { data, error } = await (await supabase)
        .from("absences")
        .select("*")
        .gte("date", format(new Date(), "yyyy-MM-01"))
        .returns<Absence[]>();

      if (error) throw error;
      setAbsences(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserShift = async (userId: string, shiftId: number) => {
    try {
      const { error } = await (await supabase)
        .from("schedules")
        .update({ working_shift: shiftId.toString() })
        .eq("user_id", userId);

      if (error) throw error;
      await fetchSchedules();
    } catch (error: any) {
      console.error("Error updating shift:", error.message);
    }
  };

  const markAbsent = async (userId: string) => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    try {
      const { error } = await (await supabase).from("absences").insert({
        user_id: userId,
        date: format(selectedDate, "yyyy-MM-dd"),
        reason: absenceReason || "No reason provided",
      });

      if (error) throw error;

      toast.success("Absence marked successfully");
      await fetchAbsences();
      setAbsenceReason(""); // Reset reason after successful submission
    } catch (error: any) {
      console.error("Error marking absence:", error.message);
      toast.error("Failed to mark absence");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Current Shift</TableHead>
            <TableHead>Off Days</TableHead>
            <TableHead>Absences This Month</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell>
                {schedule.first_name} {schedule.last_name}
              </TableCell>
              <TableCell>
                <Select
                  value={schedule.working_shift}
                  onValueChange={(value) =>
                    updateUserShift(schedule.user_id, parseInt(value))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id.toString()}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{schedule.off_days || "Not set"}</TableCell>
              <TableCell>
                {absences.filter((a) => a.user_id === schedule.user_id).length}
              </TableCell>
              <TableCell>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Mark Absent
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mark Absence</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date</label>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          className="rounded-md border"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason</label>
                        <Textarea
                          value={absenceReason}
                          onChange={(e) => setAbsenceReason(e.target.value)}
                          placeholder="Enter reason for absence"
                          className="min-h-[100px]"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => markAbsent(schedule.user_id)}
                      >
                        Confirm Absence
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ScheduleManagement;
