import { useState, useEffect, useCallback } from "react";
import { getRealTimeClient } from "@/utils/supabase/client";
import { Driver } from "../types";
import { useToast } from "@/components/ui/use-toast";
import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "driversDB";
const STORE_NAME = "drivers";

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db: IDBPDatabase) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = getRealTimeClient();

  // Load initial data from IndexedDB
  useEffect(() => {
    async function loadFromIndexedDB() {
      try {
        const db = await initDB();
        const storedDrivers = await db.get(STORE_NAME, "driversList");
        if (storedDrivers) {
          setDrivers(storedDrivers);
        }
      } catch (err) {
        console.error("Error loading from IndexedDB:", err);
      }
    }
    loadFromIndexedDB();
  }, []);

  const refreshDrivers = useCallback(async () => {
    try {
      setError(null);
      console.log("Fetching drivers from database...");

      const { data, error: fetchError } = await supabase
        .from("drivers")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      console.log(`Fetched ${data?.length || 0} drivers from database`);

      // Update state
      setDrivers(data || []);

      // Save to IndexedDB
      try {
        const db = await initDB();
        await db.put(STORE_NAME, data, "driversList");
        console.log("Saved drivers to IndexedDB");
      } catch (err) {
        console.error("Error saving to IndexedDB:", err);
      }
    } catch (err) {
      console.error("Error fetching drivers:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch drivers");
      toast({
        title: "Error",
        description: "Failed to fetch drivers",
        variant: "destructive",
      });
    }
  }, [supabase, toast]);

  useEffect(() => {
    refreshDrivers();
  }, [refreshDrivers]);

  return { drivers, error, refreshDrivers };
}
