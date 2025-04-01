import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST() {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  try {
    // Get all drivers without Stripe Connect accounts first
    const { data: driversWithoutStripe } = await supabase
      .from("drivers")
      .select("*")
      .is("stripe_connect_account_id", null);

    // Create Stripe Connect accounts for drivers that don't have one
    if (driversWithoutStripe) {
      for (const driver of driversWithoutStripe) {
        try {
          // Create a new Connect account
          const account = await stripe.accounts.create({
            type: "express",
            country: "US",
            email: driver.email,
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            },
            business_type: "individual",
            metadata: {
              driver_id: driver.id.toString(),
              name: driver.name,
              phone_number: driver.phone_number,
            },
          });

          // Update driver with Stripe Connect account ID
          await supabase
            .from("drivers")
            .update({
              stripe_connect_account_id: account.id,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", driver.id);
        } catch (error) {
          console.error(
            `Error creating Connect account for driver ${driver.id}:`,
            error
          );
        }
      }
    }

    // Get all Stripe Connect accounts
    const accounts = await stripe.accounts.list({
      limit: 100,
    });

    let syncedCount = 0;
    let createdCount = 0;

    for (const account of accounts.data) {
      // Find driver by Stripe Connect account ID
      const { data: existingDriver } = await supabase
        .from("drivers")
        .select()
        .eq("stripe_connect_account_id", account.id)
        .single();

      if (existingDriver) {
        // Update existing driver
        await supabase
          .from("drivers")
          .update({
            stripe_connect_account_id: account.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", existingDriver.id);

        syncedCount++;
      } else if (account.metadata?.driver_id) {
        // Find driver by ID in metadata
        const { data: driverById } = await supabase
          .from("drivers")
          .select()
          .eq("id", account.metadata.driver_id)
          .single();

        if (driverById) {
          // Update driver with Stripe Connect account ID
          await supabase
            .from("drivers")
            .update({
              stripe_connect_account_id: account.id,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", driverById.id);

          syncedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} and created ${createdCount} drivers from Stripe`,
    });
  } catch (error) {
    console.error("Error syncing Stripe Connect accounts:", error);
    return NextResponse.json(
      {
        error: "Failed to sync drivers with Stripe",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
