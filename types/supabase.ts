export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      absences: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          date: string;
          reason: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          date: string;
          reason: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          date?: string;
          reason?: string;
        };
      };
      users: {
        Row: {
          id: string;
          created_at: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone_number: string | null;
          role: string;
          status: string;
          has_all_access: boolean;
          company_id: number | null;
          dob: string | null;
          working_shift: string | null;
          off_days: string[] | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone_number?: string | null;
          role?: string;
          status?: string;
          has_all_access?: boolean;
          company_id?: number | null;
          dob?: string | null;
          working_shift?: string | null;
          off_days?: string[] | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone_number?: string | null;
          role?: string;
          status?: string;
          has_all_access?: boolean;
          company_id?: number | null;
          dob?: string | null;
          working_shift?: string | null;
          off_days?: string[] | null;
        };
      };
      companies: {
        Row: {
          id: number;
          created_at: string;
          name: string;
          status: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          name: string;
          status?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          name?: string;
          status?: string;
        };
      };
      user_companies: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          company_id: number;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          company_id: number;
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          company_id?: number;
        };
      };
      schedules: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          working_shift: string;
          off_days: string[];
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          working_shift: string;
          off_days: string[];
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          working_shift?: string;
          off_days?: string[];
        };
      };
      payroll_base: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          base_salary: number;
          currency: string;
          payment_frequency: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          base_salary: number;
          currency?: string;
          payment_frequency?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          base_salary?: number;
          currency?: string;
          payment_frequency?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
