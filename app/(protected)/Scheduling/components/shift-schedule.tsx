"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, addDays } from "date-fns";
import {
  useSchedulingData,
  useCreateAbsence,
  useUpdateSchedule,
  useDeleteAbsence,
} from "../hooks/useScheduling";
import { Employee, ShiftType, Absence, Schedule } from "../types";
import {
  Search,
  Calendar as CalendarIcon,
  X,
  Users,
  Clock,
  Calendar,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

const DEPARTMENTS = {
  Editor: { icon: "✏️", color: "bg-blue-100 dark:bg-blue-900/50" },
  Manager: { icon: "👔", color: "bg-purple-100 dark:bg-purple-900/50" },
  Dispatcher: { icon: "📡", color: "bg-green-100 dark:bg-green-900/50" },
  Safety: { icon: "🛡️", color: "bg-red-100 dark:bg-red-900/50" },
} as const;

const SHIFTS = {
  1: {
    label: "Morning Shift",
    shortLabel: "Morning",
    time: "06:00-14:00",
    color:
      "bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800",
    icon: "🌅",
  },
  2: {
    label: "Afternoon Shift",
    shortLabel: "Afternoon",
    time: "14:00-22:00",
    color:
      "bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800",
    icon: "🌞",
  },
  3: {
    label: "Night Shift",
    shortLabel: "Night",
    time: "22:00-06:00",
    color:
      "bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800",
    icon: "🌙",
  },
} as const;

// Define the schedule type as it comes from the API
interface APISchedule {
  id: number;
  user_id: string;
  working_shift: string;
  off_days: string[];
  created_at: string;
  updated_at: string;
}

function WeekNavigation({
  selectedDate,
  onDateChange,
}: {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}) {
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Card className="p-4">
      <div className="flex items-center space-x-4 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(addDays(weekStart, -7))}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Previous Week
        </Button>
        <Badge variant="outline" className="text-sm px-4 py-1.5">
          Week of {format(weekStart, "MMMM d, yyyy")}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(addDays(weekStart, 7))}
        >
          Next Week
          <Calendar className="h-4 w-4 ml-2" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`px-2 py-3 text-center rounded-lg transition-colors cursor-pointer ${
              format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            onClick={() => onDateChange(day)}
          >
            <div className="text-xs font-medium mb-1">{format(day, "EEE")}</div>
            <div className="text-lg font-bold">{format(day, "d")}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AbsenceDialog({
  employee,
  selectedDate,
}: {
  employee: Employee;
  selectedDate: Date;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6">
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Absence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <h4 className="font-medium">Employee</h4>
            <p>
              {employee.first_name} {employee.last_name}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Date</h4>
            <p>{format(selectedDate, "MMMM d, yyyy")}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Reason</h4>
            <Textarea placeholder="Enter reason for absence..." />
          </div>
          <div className="flex justify-end space-x-2">
            <Button>Mark as Absent</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentBadge({
  department,
}: {
  department: keyof typeof DEPARTMENTS | undefined;
}) {
  if (!department || !(department in DEPARTMENTS)) {
    return (
      <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800">
        <span className="mr-1">👤</span>
        Unassigned
      </Badge>
    );
  }

  const deptInfo = DEPARTMENTS[department];
  return (
    <Badge variant="secondary" className={`${deptInfo.color} border-0`}>
      <span className="mr-1">{deptInfo.icon}</span>
      {department}
    </Badge>
  );
}

function EmployeeCard({
  employee,
  selectedDate,
  shift,
  onShiftChange,
}: {
  employee: Employee & { off_days?: string[] };
  selectedDate: Date;
  shift: ShiftType;
  onShiftChange: (newShift: ShiftType) => void;
}) {
  const currentShift = SHIFTS[shift];
  const { data } = useSchedulingData();
  const absences = data?.absences ?? [];
  const [absenceError, setAbsenceError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAbsenceDetailsOpen, setIsAbsenceDetailsOpen] = useState(false);
  const createAbsenceMutation = useCreateAbsence();
  const deleteAbsenceMutation = useDeleteAbsence();

  // Check if there's an absence for this employee on the selected date
  const currentAbsence = absences.find(
    (absence: Absence) =>
      absence.user_id === employee.id &&
      absence.date === format(selectedDate, "yyyy-MM-dd")
  );

  const isAbsent = !!currentAbsence;

  const handleShiftChange = (newShift: string) => {
    const shiftType = parseInt(newShift) as ShiftType;

    // Update UI immediately via parent component
    onShiftChange(shiftType);
  };

  const handleAbsenceSubmit = (reason: string) => {
    if (!reason.trim()) {
      setAbsenceError("Please provide a reason for the absence");
      return;
    }

    // Show loading toast
    const toastId = toast.loading(
      `Recording absence for ${employee.first_name}...`
    );

    createAbsenceMutation.mutate(
      {
        userId: employee.id,
        date: format(selectedDate, "yyyy-MM-dd"),
        reason: reason.trim(),
      },
      {
        onSuccess: (response) => {
          if (response.error) {
            setAbsenceError(response.error);
            if (response.code !== "DUPLICATE_ABSENCE") {
              setIsDialogOpen(false);
            }
            toast.error(response.error, { id: toastId });
          } else {
            setAbsenceError(null);
            setIsDialogOpen(false);
            toast.success("Absence has been recorded successfully.", {
              id: toastId,
            });
          }
        },
        onError: (error) => {
          setAbsenceError(error.message || "Failed to create absence");
          toast.error(error.message || "Failed to create absence", {
            id: toastId,
          });
        },
      }
    );
  };

  const handleAbsenceDelete = () => {
    if (currentAbsence?.id) {
      const toastId = toast.loading("Deleting absence...");

      deleteAbsenceMutation.mutate(currentAbsence.id, {
        onSuccess: (response) => {
          if (response.error) {
            toast.error(`Failed to delete absence: ${response.error}`, {
              id: toastId,
            });
          } else {
            setIsAbsenceDetailsOpen(false);
            toast.success("Absence deleted successfully", {
              id: toastId,
            });
          }
        },
        onError: (error) => {
          toast.error(
            `Failed to delete absence: ${error.message || "Unknown error"}`,
            {
              id: toastId,
            }
          );
        },
      });
    }
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all dark:border-gray-800">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-full ${currentShift.color} flex items-center justify-center border-2 dark:border-gray-700 flex-shrink-0`}
        >
          <span className="text-sm font-semibold">
            {employee.first_name[0]}
            {employee.last_name[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {employee.first_name} {employee.last_name}
            </span>
            <DepartmentBadge
              department={
                employee.department as keyof typeof DEPARTMENTS | undefined
              }
            />
            {isAbsent && (
              <div className="flex items-center gap-1">
                <Dialog
                  open={isAbsenceDetailsOpen}
                  onOpenChange={setIsAbsenceDetailsOpen}
                >
                  <DialogTrigger asChild>
                    <Badge
                      variant="destructive"
                      className="cursor-pointer hover:bg-destructive/90"
                    >
                      Absent
                    </Badge>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Absence Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Employee</h4>
                        <p>
                          {employee.first_name} {employee.last_name}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Date</h4>
                        <p>{format(selectedDate, "MMMM d, yyyy")}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Reason</h4>
                        <p className="text-sm text-muted-foreground">
                          {currentAbsence?.reason}
                        </p>
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setIsAbsenceDetailsOpen(false)}
                        >
                          Close
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleAbsenceDelete}
                          disabled={deleteAbsenceMutation.status === "pending"}
                        >
                          {deleteAbsenceMutation.status === "pending"
                            ? "Deleting..."
                            : "Delete Absence"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setAbsenceError(null);
                      }}
                    >
                      <CalendarIcon className="h-4 w-4 text-destructive" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mark Absence</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Employee</h4>
                        <p>
                          {employee.first_name} {employee.last_name}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Date</h4>
                        <p>{format(selectedDate, "MMMM d, yyyy")}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Reason</h4>
                        <Textarea
                          placeholder="Enter reason for absence..."
                          onChange={(e) => {
                            if (absenceError) setAbsenceError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAbsenceSubmit(e.currentTarget.value);
                            }
                          }}
                        />
                        {absenceError && (
                          <p className="text-sm text-destructive">
                            {absenceError}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={(e) => {
                            const textarea = e.currentTarget
                              .closest("div[role='dialog']")
                              ?.querySelector("textarea");
                            if (textarea) {
                              handleAbsenceSubmit(textarea.value);
                            }
                          }}
                        >
                          Mark as Absent
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark absence</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select
                  value={shift.toString()}
                  onValueChange={handleShiftChange}
                >
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        {SHIFTS[shift as ShiftType].icon}
                        {SHIFTS[shift as ShiftType].shortLabel}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHIFTS).map(
                      ([value, { label, icon, time }]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {icon} {label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {time}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>
                <p>Change shift</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}

function ShiftGroup({
  title,
  icon,
  color,
  time,
  employees,
  selectedDate,
  onShiftChange,
}: {
  title: string;
  icon: string;
  color: string;
  time: string;
  employees: { employee: Employee; shift: ShiftType }[];
  selectedDate: Date;
  onShiftChange: (employeeId: string, newShift: ShiftType) => void;
}) {
  return (
    <Card className="overflow-hidden dark:border-gray-800">
      <div
        className={`${color} px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{time}</p>
          </div>
        </div>
        <Badge variant="secondary" className="px-3 py-1 dark:bg-gray-800">
          {employees.length} employees
        </Badge>
      </div>
      <ScrollArea className="h-[300px] dark:bg-background">
        <div className="p-4 space-y-2">
          {employees.map(({ employee, shift }) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              selectedDate={selectedDate}
              shift={shift}
              onShiftChange={(newShift) => onShiftChange(employee.id, newShift)}
            />
          ))}
          {employees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No employees assigned to this shift</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function CountCard({
  title,
  count,
  icon: Icon,
  suffix,
}: {
  title: string;
  count: number;
  icon: any;
  suffix?: string;
}) {
  return (
    <Card className="p-4 dark:border-gray-800">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 dark:bg-primary/5 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold">
            {count}
            {suffix && <span className="text-lg ml-1">{suffix}</span>}
          </h3>
        </div>
      </div>
    </Card>
  );
}

export default function ShiftSchedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const { data, isLoading: dataLoading } = useSchedulingData();
  const updateScheduleMutation = useUpdateSchedule();
  const employees = data?.employees ?? [];
  const absences = data?.absences ?? [];
  const schedules = (data?.schedules ?? []) as APISchedule[];

  // Initialize employee shifts from schedules
  const employeeShifts = useMemo(() => {
    const shifts: Record<string, ShiftType> = {};
    schedules.forEach((schedule) => {
      shifts[schedule.user_id] = parseInt(schedule.working_shift) as ShiftType;
    });
    return shifts;
  }, [schedules]);

  // Local state to track shifts that are being updated
  const [localEmployeeShifts, setLocalEmployeeShifts] = useState<
    Record<string, ShiftType>
  >({});

  // Combine server data with local updates
  const effectiveEmployeeShifts = useMemo(() => {
    return { ...employeeShifts, ...localEmployeeShifts };
  }, [employeeShifts, localEmployeeShifts]);

  const isLoading = dataLoading || !employees;

  if (isLoading) {
    return (
      <div className="h-[500px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch =
      employee.first_name.toLowerCase().includes(searchTerm) ||
      employee.last_name.toLowerCase().includes(searchTerm) ||
      employee.department?.toLowerCase().includes(searchTerm);

    const matchesDepartment =
      selectedDepartment === "all" ||
      employee.department === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  // Group employees by their current shift from schedules or default
  const employeesByShift = {
    1: filteredEmployees
      .filter(
        (employee) =>
          effectiveEmployeeShifts[employee.id] === 1 ||
          (!effectiveEmployeeShifts[employee.id] &&
            filteredEmployees.indexOf(employee) <
              Math.floor(filteredEmployees.length / 3))
      )
      .map((employee) => ({
        employee,
        shift: effectiveEmployeeShifts[employee.id] || (1 as ShiftType),
      })),
    2: filteredEmployees
      .filter(
        (employee) =>
          effectiveEmployeeShifts[employee.id] === 2 ||
          (!effectiveEmployeeShifts[employee.id] &&
            filteredEmployees.indexOf(employee) >=
              Math.floor(filteredEmployees.length / 3) &&
            filteredEmployees.indexOf(employee) <
              Math.floor((2 * filteredEmployees.length) / 3))
      )
      .map((employee) => ({
        employee,
        shift: effectiveEmployeeShifts[employee.id] || (2 as ShiftType),
      })),
    3: filteredEmployees
      .filter(
        (employee) =>
          effectiveEmployeeShifts[employee.id] === 3 ||
          (!effectiveEmployeeShifts[employee.id] &&
            filteredEmployees.indexOf(employee) >=
              Math.floor((2 * filteredEmployees.length) / 3))
      )
      .map((employee) => ({
        employee,
        shift: effectiveEmployeeShifts[employee.id] || (3 as ShiftType),
      })),
  };

  const handleShiftChange = async (employeeId: string, newShift: ShiftType) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    // Update local state immediately for UI feedback
    setLocalEmployeeShifts((prev) => ({
      ...prev,
      [employeeId]: newShift,
    }));

    // Show loading toast
    const toastId = toast.loading(`Updating ${employee.first_name}'s shift...`);

    try {
      const result = await updateScheduleMutation.mutateAsync({
        userId: employeeId,
        workingShift: newShift,
        offDays: ["saturday", "sunday"], // Default weekend off days
      });

      if (result.error) {
        // If there's an error, revert the local change
        setLocalEmployeeShifts((prev) => {
          const newState = { ...prev };
          delete newState[employeeId]; // Remove local override
          return newState;
        });

        toast.error(`Failed to update shift: ${result.error}`, {
          id: toastId,
        });
      } else {
        toast.success(`${employee.first_name}'s shift updated successfully`, {
          id: toastId,
        });
      }
    } catch (error) {
      // On error, revert the local change
      setLocalEmployeeShifts((prev) => {
        const newState = { ...prev };
        delete newState[employeeId]; // Remove local override
        return newState;
      });

      toast.error(
        `Failed to update shift: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          id: toastId,
        }
      );
      console.error("Error updating shift:", error);
    }
  };

  const activeShifts = Object.values(employeesByShift).filter(
    (shift) => shift.length > 0
  ).length;

  const todayAbsences =
    absences?.filter(
      (absence) => absence.date === format(new Date(), "yyyy-MM-dd")
    ).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Shift Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Manage employee shifts and absences
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue>
                {selectedDepartment === "all" ? (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Departments
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {
                      DEPARTMENTS[
                        selectedDepartment as keyof typeof DEPARTMENTS
                      ]?.icon
                    }
                    {selectedDepartment}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  All Departments
                </span>
              </SelectItem>
              {Object.entries(DEPARTMENTS).map(([dept, { icon }]) => (
                <SelectItem key={dept} value={dept}>
                  <span className="flex items-center gap-2">
                    {icon} {dept}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search employees, roles, or departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <WeekNavigation
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.entries(SHIFTS).map(([key, { label, icon, color, time }]) => (
          <ShiftGroup
            key={key}
            title={label}
            icon={icon}
            color={color}
            time={time}
            employees={employeesByShift[key as unknown as ShiftType]}
            selectedDate={selectedDate}
            onShiftChange={(employeeId, newShift) =>
              handleShiftChange(employeeId, newShift)
            }
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CountCard
          title="Total Employees"
          count={data?.stats.totalEmployees || 0}
          icon={Users}
        />
        <CountCard title="Active Shifts" count={activeShifts} icon={Clock} />
        <CountCard
          title="Today's Absences"
          count={todayAbsences}
          icon={Calendar}
        />
      </div>
    </div>
  );
}
