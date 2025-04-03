import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { RealtimePayload } from "./types";

export function setupDriversSubscription(
  onUpdate: (payload: RealtimePayload) => Promise<void>
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel("drivers_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "drivers",
      },
      async (payload) => {
        const eventType = payload.eventType;
        const newRecord = payload.new;
        const oldRecord = payload.old;

        await onUpdate({
          eventType,
          new: newRecord,
          old: oldRecord,
        } as RealtimePayload);
      }
    )
    .subscribe();

  return channel;
}
