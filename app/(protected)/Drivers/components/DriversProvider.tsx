"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

interface Document {
  id: number;
  expiration_date: string;
}

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  status: string;
  driver_licenses: Document[];
  medical_cards: Document[];
  mvr_files: Document[];
  company_id: number;
  subscription_amount: number;
  stripe_product_id: string | null;
  hire_date: string;
  terminated_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DriversContextType {
  drivers: Driver[];
  loading: boolean;
  error: string | null;
  refreshDrivers: () => Promise<void>;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

export function DriversProvider({ children }: { children: React.ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/drivers", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid data format received from server");
      }

      setDrivers(data);
    } catch (err) {
      console.error("Error fetching drivers:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);

      if (
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        // Redirect to login page
        window.location.href = "/login";
      } else {
        toast({
          title: "Error",
          description: "Failed to load drivers. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  return (
    <DriversContext.Provider
      value={{
        drivers,
        loading,
        error,
        refreshDrivers: fetchDrivers,
      }}
    >
      {children}
    </DriversContext.Provider>
  );
}

export function useDrivers() {
  const context = useContext(DriversContext);
  if (context === undefined) {
    throw new Error("useDrivers must be used within a DriversProvider");
  }
  return context;
}
