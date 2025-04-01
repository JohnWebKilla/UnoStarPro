import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get all drivers
    const { data: drivers, error: fetchError } = await supabase
      .from("drivers")
      .select("*");

    if (fetchError) {
      console.error("Error fetching drivers:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch drivers" },
        { status: 500 }
      );
    }

    // Update each driver with default values if they don't have subscription_frequency
    for (const driver of drivers) {
      if (!driver.subscription_frequency) {
        const { error: updateError } = await supabase
          .from("drivers")
          .update({
            subscription_frequency: "monthly",
            stripe_price_id: null,
            stripe_connect_account_id: null,
            last_synced_at: null,
          })
          .eq("id", driver.id);

        if (updateError) {
          console.error(`Error updating driver ${driver.id}:`, updateError);
          continue;
        }
      }
    }

    // Trigger a sync with Stripe to update all statuses
    const syncResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/drivers/sync`,
      {
        method: "POST",
      }
    );

    if (!syncResponse.ok) {
      console.error("Error syncing with Stripe:", await syncResponse.text());
      return NextResponse.json(
        { error: "Failed to sync with Stripe" },
        { status: 500 }
      );
    }

    const syncResult = await syncResponse.json();
    return NextResponse.json({ success: true, syncResult });
  } catch (error) {
    console.error("Error in migration:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
