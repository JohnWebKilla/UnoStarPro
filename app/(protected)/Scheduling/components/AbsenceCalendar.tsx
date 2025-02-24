"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, isSameDay, parseISO } from "date-fns";
import { createAbsence, deleteAbsence, updateAbsence } from "../actions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Trash2, Edit, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useScheduling } from "../page";

export default function AbsenceCalendar() {
  const { employees, absences, isLoading, refreshData } = useScheduling();
  const [date, setDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAbsence = async () => {
    if (!date || !selectedEmployee || !reason) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingAbsence) {
        const { error } = await updateAbsence(editingAbsence.id, { reason });
        if (error) throw new Error(error);
        toast.success("Absence updated successfully");
      } else {
        const { error } = await createAbsence({
          userId: selectedEmployee,
          date: format(date, "yyyy-MM-dd"),
          reason,
        });
        if (error) throw new Error(error);
        toast.success("Absence added successfully");
      }

      setIsDialogOpen(false);
      setSelectedEmployee("");
      setReason("");
      setEditingAbsence(null);
      await refreshData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAbsence = async (id: number) => {
    try {
      setIsSubmitting(true);
      const { error } = await deleteAbsence(id);
      if (error) throw new Error(error);
      toast.success("Absence deleted successfully");
      await refreshData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAbsence = (absence: any) => {
    setEditingAbsence(absence);
    setSelectedEmployee(absence.user_id);
    setReason(absence.reason);
    setDate(parseISO(absence.date));
    setIsDialogOpen(true);
  };

  const getDayAbsences = (day: Date) => {
    return absences.filter((absence) => isSameDay(parseISO(absence.date), day));
  };

  const getEmployeeName = (userId: string) => {
    const employee = employees.find((e) => e.id === userId);
    return employee
      ? `${employee.first_name} ${employee.last_name}`
      : "Unknown";
  };

  const renderAbsenceList = () => {
    if (isLoading) {
      return Array(3)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
            <Skeleton className="h-4 w-[300px]" />
          </div>
        ));
    }

    const dayAbsences = getDayAbsences(date);

    if (dayAbsences.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No absences recorded for this day
        </div>
      );
    }

    return dayAbsences.map((absence) => (
      <div
        key={absence.id}
        className="flex justify-between items-start p-4 bg-muted/50 rounded-lg"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{getEmployeeName(absence.user_id)}</p>
            <Badge variant="outline">
              {format(parseISO(absence.date), "MMM d")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{absence.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditAbsence(absence)}
                  disabled={isSubmitting}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit absence</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteAbsence(absence.id)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete absence</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Absence Calendar</h2>
          <p className="text-muted-foreground mt-1">
            Manage and track employee absences
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Add Absence
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingAbsence ? "Edit Absence" : "Add New Absence"}
              </DialogTitle>
              <DialogDescription>
                {editingAbsence
                  ? "Update the absence details below"
                  : "Fill in the details to record a new absence"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <Select
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                  disabled={!!editingAbsence || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  className="rounded-md border"
                  disabled={!!editingAbsence || isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for absence"
                  className="min-h-[100px]"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingAbsence(null);
                    setSelectedEmployee("");
                    setReason("");
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddAbsence} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingAbsence ? "Updating..." : "Adding..."}
                    </>
                  ) : editingAbsence ? (
                    "Update Absence"
                  ) : (
                    "Add Absence"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
            <CardDescription>
              Days with absences are highlighted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                className="rounded-md border"
                modifiers={{
                  hasAbsence: (day) => getDayAbsences(day).length > 0,
                }}
                modifiersStyles={{
                  hasAbsence: {
                    backgroundColor: "rgb(254 242 242)",
                    color: "rgb(239 68 68)",
                    fontWeight: "bold",
                  },
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Absences for {format(date, "MMMM d, yyyy")}</CardTitle>
            <CardDescription>
              {!isLoading &&
                `${getDayAbsences(date).length} absence(s) recorded`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">{renderAbsenceList()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
