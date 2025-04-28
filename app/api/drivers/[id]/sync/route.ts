import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";
import { syncDriverWithStripe } from "@/app/(protected)/Drivers/stripe-actions";
import { clearDriverCache } from "@/app/(protected)/Drivers/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const driverId = parseInt(params.id);

    if (isNaN(driverId)) {
      return NextResponse.json({ error: "Invalid driver ID" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get driver data
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select()
      .eq("id", driverId)
      .single();

    if (driverError) {
      return NextResponse.json({ error: driverError.message }, { status: 500 });
    }

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Update driver data with any data from the request
    const requestData = await request.json().catch(() => ({}));

    if (requestData && Object.keys(requestData).length > 0) {
      const { error: updateError } = await supabase
        .from("drivers")
        .update({
          ...requestData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      // Get updated driver data
      const { data: updatedDriver, error: getError } = await supabase
        .from("drivers")
        .select()
        .eq("id", driverId)
        .single();

      if (getError || !updatedDriver) {
        return NextResponse.json(
          { error: getError?.message || "Failed to get updated driver" },
          { status: 500 }
        );
      }

      driver.name = updatedDriver.name;
      driver.subscription_amount = updatedDriver.subscription_amount;
      driver.subscription_frequency = updatedDriver.subscription_frequency;
      driver.phone_number = updatedDriver.phone_number;
      driver.truck_number = updatedDriver.truck_number;
      driver.solo_or_team = updatedDriver.solo_or_team;
    }

    // Sync driver with Stripe
    const result = await syncDriverWithStripe(driver);

    // Clear cache for this driver
    await clearDriverCache(driverId);

    // Return the result
    return NextResponse.json({
      success: result.success,
      message: result.message,
      driver: result.driver,
    });
  } catch (error) {
    console.error("Error syncing driver with Stripe:", error);
    return NextResponse.json(
      {
        error: "Failed to sync driver with Stripe",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
