import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { id } = context.params;

    // Get driver details
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    let product;
    let price;

    // If driver already has a Stripe product, update it
    if (driver.stripe_product_id) {
      try {
        // Update existing product
        product = await stripe.products.update(driver.stripe_product_id, {
          name: driver.name,
          metadata: {
            driver_id: driver.id.toString(),
          },
        });

        // Update or create price if subscription amount changed
        if (driver.stripe_price_id) {
          const existingPrice = await stripe.prices.retrieve(
            driver.stripe_price_id
          );
          if (existingPrice.unit_amount !== driver.subscription_amount * 100) {
            // Create new price if amount changed
            price = await stripe.prices.create({
              product: product.id,
              unit_amount: driver.subscription_amount * 100,
              currency: "usd",
              recurring: {
                interval:
                  driver.subscription_frequency === "monthly"
                    ? "month"
                    : "week",
              },
            });
          } else {
            price = existingPrice;
          }
        }
      } catch (stripeError) {
        // If product not found in Stripe, create new one
        if ((stripeError as any).code === "resource_missing") {
          product = null;
        } else {
          throw stripeError;
        }
      }
    }

    // If no product exists or couldn't be updated, create new one
    if (!product) {
      product = await stripe.products.create({
        name: driver.name,
        metadata: {
          driver_id: driver.id.toString(),
        },
      });

      // Create new price
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: driver.subscription_amount * 100,
        currency: "usd",
        recurring: {
          interval:
            driver.subscription_frequency === "monthly" ? "month" : "week",
        },
      });
    }

    // Update driver with Stripe product and price IDs
    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price?.id || driver.stripe_price_id,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      product_id: product.id,
      price_id: price?.id || driver.stripe_price_id,
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
