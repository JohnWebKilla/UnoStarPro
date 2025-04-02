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
    // Get all drivers from database
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("*");

    if (driversError) throw driversError;

    // Get all Stripe products
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    });

    const productMap = new Map(
      products.data.map((product) => [product.metadata.driver_id, product])
    );

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    // Process each driver
    for (const driver of drivers || []) {
      try {
        let product = productMap.get(driver.id.toString());
        let price;

        // If driver has no Stripe product or it's not found in Stripe, create new one
        if (!driver.stripe_product_id || !product) {
          product = await stripe.products.create({
            name: driver.name,
            metadata: {
              driver_id: driver.id.toString(),
            },
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

          results.created++;
        } else {
          // Update existing product if needed
          if (product.name !== driver.name) {
            product = await stripe.products.update(product.id, {
              name: driver.name,
            });
          }

          // Check if price needs to be updated
          if (driver.stripe_price_id) {
            const existingPrice = await stripe.prices.retrieve(
              driver.stripe_price_id
            );
            if (
              existingPrice.unit_amount !== driver.subscription_amount * 100 ||
              existingPrice.recurring?.interval !==
                (driver.subscription_frequency === "monthly" ? "month" : "week")
            ) {
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
          } else {
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
          }

          results.updated++;
        }

        // Update driver with latest Stripe IDs
        const { error: updateError } = await supabase
          .from("drivers")
          .update({
            stripe_product_id: product.id,
            stripe_price_id: price.id,
          })
          .eq("id", driver.id);

        if (updateError) throw updateError;
      } catch (error) {
        console.error(`Error processing driver ${driver.id}:`, error);
        results.errors.push(
          `Driver ${driver.id} (${driver.name}): ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.updated} and created ${results.created} products in Stripe`,
      errors: results.errors,
    });
  } catch (error) {
    console.error("Error syncing with Stripe:", error);
    return NextResponse.json(
      {
        error: "Failed to sync with Stripe",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
