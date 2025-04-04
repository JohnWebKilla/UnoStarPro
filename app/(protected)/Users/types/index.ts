export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  role: string;
  status: "active" | "inactive";
  avatar?: string;
  department_id?: string;
  department?: string;
  phone_number?: string;
  dob?: string;
  working_shift?: string;
  off_days?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}
