import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { RealtimePayload } from "./types";

export function setupDriversSubscription(
  onUpdate: (payload: RealtimePayload) => Promise<void>
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel("drivers_status_changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "drivers",
        filter: "status=eq.status", // Only listen for status changes
      },
      async (payload) => {
        const eventType = payload.eventType;
        const newRecord = payload.new;
        const oldRecord = payload.old;

        // Only process if status has actually changed
        if (newRecord.status !== oldRecord.status) {
          await onUpdate({
            eventType,
            new: newRecord,
            old: oldRecord,
          } as RealtimePayload);
        }
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });

  return channel;
}

// Optimized function for updating driver status locally
export function updateDriverStatusLocally(
  drivers: any[],
  driverId: number,
  newStatus: string
): any[] {
  return drivers.map((driver) =>
    driver.id === driverId ? { ...driver, status: newStatus } : driver
  );
}
