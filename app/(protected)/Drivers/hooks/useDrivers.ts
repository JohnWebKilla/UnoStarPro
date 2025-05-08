import { useState, useEffect, useCallback } from "react";
import { getRealTimeClient } from "@/utils/supabase/client";
import { Driver } from "../types";
import { useToast } from "@/components/ui/use-toast";
import { openDB, IDBPDatabase } from "idb";
import { useDrivers as useDriversContext } from "../components/DriversClientProvider";

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

// Instead of reimplementing the hook, just re-export the context hook
export function useDrivers() {
  return useDriversContext();
}
