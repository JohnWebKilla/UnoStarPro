"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Textarea } from "@/components/ui/textarea";
import { format, isSameDay } from "date-fns";
import {
  useEmployees,
  useAbsences,
  useCreateAbsence,
} from "../hooks/useScheduling";
import { Employee } from "../types";
import { toast } from "sonner";

function AbsenceForm({ onClose }: { onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [reason, setReason] = useState("");

  const employees = useEmployees();
  const { mutate: createAbsence, isPending } = useCreateAbsence();

  const handleSubmit = () => {
    if (!selectedEmployee || !selectedDate) {
      toast.error("Please select an employee and date");
      return;
    }

    createAbsence(
      {
        userId: selectedEmployee,
        date: format(selectedDate, "yyyy-MM-dd"),
        reason: reason.trim() || "No reason provided",
      },
      {
        onSuccess: () => {
          toast.success("Absence recorded successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to record absence"
          );
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium">Employee</h4>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger>
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Date</h4>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border"
          disabled={(date) => date < new Date()}
        />
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Reason</h4>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for absence"
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Recording..." : "Record Absence"}
        </Button>
      </div>
    </div>
  );
}

function AbsenceList() {
  const absences = useAbsences();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dayAbsences = absences?.filter((absence) =>
    isSameDay(new Date(absence.date), selectedDate)
  );

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && setSelectedDate(date)}
        className="rounded-md border"
      />

      <div className="space-y-2">
        <h4 className="font-medium">
          Absences for {format(selectedDate, "MMMM d, yyyy")}
        </h4>
        <div className="space-y-2">
          {dayAbsences?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No absences recorded for this date
            </p>
          ) : (
            dayAbsences?.map((absence) => (
              <Card key={absence.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">
                        {absence.user.first_name} {absence.user.last_name}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {absence.user.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm">Reason: {absence.reason}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AbsenceCalendar() {
  const [isAddingAbsence, setIsAddingAbsence] = useState(false);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Absence Calendar</h3>
            <p className="text-sm text-muted-foreground">
              View and manage employee absences
            </p>
          </div>

          <Dialog open={isAddingAbsence} onOpenChange={setIsAddingAbsence}>
            <DialogTrigger asChild>
              <Button>Record Absence</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record New Absence</DialogTitle>
              </DialogHeader>
              <AbsenceForm onClose={() => setIsAddingAbsence(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <AbsenceList />
      </div>
    </Card>
  );
}
