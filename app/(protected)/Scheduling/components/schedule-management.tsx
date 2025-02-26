"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useEmployees, useUpdateSchedule } from "../hooks/useScheduling";
import { Employee, ShiftType } from "../types";
import { toast } from "sonner";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SHIFTS = {
  1: { label: "Morning (6AM-2PM)", color: "bg-blue-100" },
  2: { label: "Afternoon (2PM-10PM)", color: "bg-green-100" },
  3: { label: "Night (10PM-6AM)", color: "bg-purple-100" },
} as const;

function EmployeeScheduleForm({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const [selectedShift, setSelectedShift] = useState<ShiftType>(1);
  const [offDays, setOffDays] = useState<string[]>([]);
  const { mutate: updateSchedule, isPending } = useUpdateSchedule();

  const handleSubmit = () => {
    updateSchedule(
      {
        userId: employee.id,
        workingShift: selectedShift,
        offDays: offDays,
      },
      {
        onSuccess: () => {
          toast.success("Schedule updated successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to update schedule"
          );
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="font-medium">Working Shift</h4>
        <Select
          value={selectedShift.toString()}
          onValueChange={(value) =>
            setSelectedShift(parseInt(value) as ShiftType)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select shift" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SHIFTS).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Off Days</h4>
        <div className="grid grid-cols-2 gap-4">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center space-x-2">
              <Checkbox
                id={day}
                checked={offDays.includes(day.toLowerCase())}
                onCheckedChange={(checked) => {
                  setOffDays(
                    checked
                      ? [...offDays, day.toLowerCase()]
                      : offDays.filter((d) => d !== day.toLowerCase())
                  );
                }}
              />
              <label
                htmlFor={day}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {day}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving..." : "Save Schedule"}
        </Button>
      </div>
    </div>
  );
}

function EmployeeCard({
  employee,
  onEdit,
}: {
  employee: Employee;
  onEdit: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">
            {employee.first_name} {employee.last_name}
          </h4>
          <p className="text-sm text-muted-foreground">{employee.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit Schedule
        </Button>
      </div>
    </Card>
  );
}

export default function ScheduleManagement() {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const employees = useEmployees();

  if (employees.isLoading) {
    return (
      <div className="h-[500px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Schedule Management</h3>
            <p className="text-sm text-muted-foreground">
              Manage employee schedules and shifts
            </p>
          </div>
        </div>

        {editingEmployee ? (
          <EmployeeScheduleForm
            employee={editingEmployee}
            onClose={() => setEditingEmployee(null)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employees.employees?.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onEdit={() => setEditingEmployee(employee)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
