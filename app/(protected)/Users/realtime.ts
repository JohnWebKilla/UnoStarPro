import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { User } from "./types";

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: User;
  old: User;
}

export function setupUsersSubscription(
  onUpdate: (payload: RealtimePayload) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel("users_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "users",
      },
      (payload) => {
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        onUpdate({
          eventType,
          new: payload.new as User,
          old: payload.old as User,
        });
      }
    )
    .subscribe();

  return channel;
}
