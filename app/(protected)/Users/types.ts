export type UserRole = "admin" | "manager" | "user" | "driver" | "customer";

export interface Company {
  id: number;
  name: string;
  status: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: UserRole;
  status: string;
  created_at: string;
  dob?: string;
  avatar?: string;
  company_id: number | null;
  has_all_access: boolean;
  companies?: Company[];
  working_shift?: string;
  off_days?: string[];
}
