import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();

    // Extract driver ID from the URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const id = segments[segments.length - 2]; // assumes /api/drivers/[id]/sync

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
        product = await stripe.products.update(driver.stripe_product_id, {
          name: driver.name,
          metadata: { driver_id: driver.id.toString() },
        });

        if (driver.stripe_price_id) {
          const existingPrice = await stripe.prices.retrieve(
            driver.stripe_price_id
          );
          if (existingPrice.unit_amount !== driver.subscription_amount * 100) {
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
      } catch (stripeError: any) {
        if (stripeError.code === "resource_missing") {
          product = null;
        } else {
          throw stripeError;
        }
      }
    }

    if (!product) {
      product = await stripe.products.create({
        name: driver.name,
        metadata: { driver_id: driver.id.toString() },
      });

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
