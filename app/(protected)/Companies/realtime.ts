import { getRealTimeClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Company, RealtimePayload } from "./types";

export function setupCompaniesSubscription(
  onUpdate: (payload: RealtimePayload) => Promise<void>
): RealtimeChannel {
  console.log("Setting up Supabase companies realtime subscription");
  const supabase = getRealTimeClient();

  // Debug: Check that we have a valid Supabase client
  if (!supabase) {
    console.error("Supabase client is undefined or null");
    throw new Error("Supabase client is undefined or null");
  }

  // Debug: Log the Supabase URL and key (partial for security)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log(
      "Supabase URL is set:",
      process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 15) + "..."
    );
  } else {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not set!");
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log(
      "Supabase key is set (first 5 chars):",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 5) + "..."
    );
  } else {
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set!");
  }

  // Get the user's session to verify authentication
  supabase.auth.getSession().then(({ data }) => {
    console.log(
      "Current auth session:",
      data.session ? "Active" : "No active session"
    );
  });

  // Create a specific channel name that includes user ID for better tracking
  const channelName = `companies_updates_${Date.now()}`;
  console.log("Creating realtime channel:", channelName);

  // Debug: Verify the channel can be created
  try {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "companies",
        },
        async (payload) => {
          console.log("Received UPDATE payload:", payload);
          const eventType = payload.eventType;
          const newRecord = payload.new as Company;
          const oldRecord = payload.old as Company;

          // Process all updates
          await onUpdate({
            eventType,
            new: newRecord,
            old: oldRecord,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "companies",
        },
        async (payload) => {
          console.log("Received INSERT payload:", payload);
          const eventType = payload.eventType;
          const newRecord = payload.new as Company;

          // Create a placeholder for the old record
          const emptyCompany: Partial<Company> = {
            id: -1,
            name: "",
            contact_email: "",
            contact_phone: "",
            status: "inactive",
          };

          await onUpdate({
            eventType,
            new: newRecord,
            old: emptyCompany as Company,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "companies",
        },
        async (payload) => {
          console.log("Received DELETE payload:", payload);
          const eventType = payload.eventType;
          const oldRecord = payload.old as Company;

          await onUpdate({
            eventType,
            new: {
              ...oldRecord,
              id: -1, // Use a special ID to indicate deletion
            },
            old: oldRecord,
          });
        }
      )
      .subscribe((status, err) => {
        console.log("Realtime subscription status:", status);
        if (err) {
          console.error("Realtime subscription error:", err);
        } else {
          console.log("Successfully subscribed to realtime updates");
        }
      });

    return channel;
  } catch (error) {
    console.error("Error setting up realtime channel:", error);
    throw error;
  }
}

// Optimized function for updating company status locally
export function updateCompanyStatusLocally(
  companies: Company[],
  companyId: number,
  newStatus: "active" | "inactive"
): Company[] {
  return companies.map((company) =>
    company.id === companyId ? { ...company, status: newStatus } : company
  );
}
