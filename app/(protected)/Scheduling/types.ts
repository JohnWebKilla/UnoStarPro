export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  phone_number?: string;
}

export interface Schedule {
  id: number;
  user_id: string;
  working_shift: number;
  off_days: string[];
  created_at: string;
  updated_at: string;
}

export interface Absence {
  id: number;
  user_id: string;
  date: string;
  reason: string;
  created_at: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface SchedulingStats {
  totalEmployees: number;
  activeShifts: number;
  todayAbsences: number;
  error: string | null;
}

export type ShiftType = 1 | 2 | 3; // Morning, Afternoon, Night

export interface ScheduleFilters {
  department?: string;
  startDate: Date;
  endDate: Date;
}

export interface AbsenceFormData {
  userId: string;
  date: string;
  reason: string;
}

export interface ScheduleFormData {
  userId: string;
  workingShift: ShiftType;
  offDays: string[];
}
