import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Company } from "../types";
import { useToast } from "@/components/ui/use-toast";
import { openDB, IDBPDatabase } from "idb";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

const DB_NAME = "companiesDB";
const STORE_NAME = "companies";

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db: IDBPDatabase) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

async function updateCache(companies: Company[]) {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, companies, "companiesList");
    console.log("Updated IndexedDB cache with new data");
  } catch (err) {
    console.error("Error updating IndexedDB cache:", err);
  }
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  // Load initial data from IndexedDB
  useEffect(() => {
    async function loadFromIndexedDB() {
      try {
        const db = await initDB();
        const storedCompanies = await db.get(STORE_NAME, "companiesList");
        if (storedCompanies) {
          setCompanies(storedCompanies);
          console.log("Loaded initial data from IndexedDB");
        } else {
          // If no cached data, fetch from Supabase
          refreshCompanies(true);
        }
      } catch (err) {
        console.error("Error loading from IndexedDB:", err);
        // If error loading from cache, fetch from Supabase
        refreshCompanies(true);
      }
    }
    loadFromIndexedDB();
  }, []);

  const refreshCompanies = useCallback(
    async (skipCache: boolean = false) => {
      try {
        setError(null);
        console.log("Refreshing companies, skipCache:", skipCache);

        // If not skipping cache and we have data in IndexedDB, use that first
        if (!skipCache) {
          try {
            const db = await initDB();
            const cachedData = await db.get(STORE_NAME, "companiesList");
            if (cachedData) {
              console.log("Using cached data from IndexedDB");
              setCompanies(cachedData);
            }
          } catch (err) {
            console.error("Error accessing IndexedDB:", err);
          }
        }

        // Always fetch fresh data from Supabase
        const { data: freshData, error: fetchError } = await supabase
          .from("companies")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        if (freshData) {
          // Update state with fresh data
          setCompanies(freshData);
          // Update cache
          await updateCache(freshData);
        }
      } catch (err) {
        console.error("Error fetching companies:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch companies"
        );
        toast({
          title: "Error",
          description: "Failed to fetch companies",
          variant: "destructive",
        });
      }
    },
    [supabase, toast]
  );

  // Set up real-time subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Unsubscribe from any existing subscription
      if (channel) {
        await supabase.removeChannel(channel);
      }

      channel = supabase
        .channel("companies_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "companies",
          },
          async (payload: RealtimePostgresChangesPayload<Company>) => {
            console.log("Real-time update received:", payload);

            // Fetch fresh data immediately after any change
            const { data: freshData, error: fetchError } = await supabase
              .from("companies")
              .select("*")
              .order("created_at", { ascending: false });

            if (fetchError) {
              console.error("Error fetching updated data:", fetchError);
              return;
            }

            if (freshData) {
              setCompanies(freshData);
              await updateCache(freshData);
              console.log("Updated companies data after real-time change");
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [supabase]);

  // Initial data fetch
  useEffect(() => {
    refreshCompanies(true);
  }, [refreshCompanies]);

  return { companies, error, refreshCompanies };
}
