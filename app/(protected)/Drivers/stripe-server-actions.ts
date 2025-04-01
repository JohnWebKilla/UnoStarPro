"use server";

import { Driver } from "./types";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Convert our subscription frequency to Stripe's format
function convertToStripeInterval(
  frequency: string
): "day" | "week" | "month" | "year" {
  const mapping: Record<string, "day" | "week" | "month" | "year"> = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    yearly: "year",
  };

  const interval = mapping[frequency.toLowerCase()];
  if (!interval) {
    throw new Error(`Invalid subscription frequency: ${frequency}`);
  }

  return interval;
}

type SyncStripeResult =
  | { success: true; productId: string; priceId: string }
  | { success: false; error: string };

export async function syncStripeConnectAccountAction(
  driverId: number
): Promise<SyncStripeResult> {
  if (!stripe) {
    return {
      success: false,
      error: "Stripe is not configured",
    };
  }

  try {
    const supabase = await createClient();

    // Get driver data
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select()
      .eq("id", driverId)
      .single();

    if (driverError) {
      return {
        success: false,
        error: driverError.message,
      };
    }
    if (!driver) {
      return {
        success: false,
        error: "Driver not found",
      };
    }

    let product: Stripe.Product;
    let price: Stripe.Price;

    if (!driver.stripe_product_id) {
      // Create new product in Stripe
      product = await stripe.products.create({
        name: driver.name,
        description: `Driver: ${driver.name} (${driver.truck_number})`,
        metadata: {
          driver_id: driver.id.toString(),
          name: driver.name,
          phone_number: driver.phone_number,
          truck_number: driver.truck_number,
          solo_or_team: driver.solo_or_team,
          company_id: driver.company_id.toString(),
        },
      });

      // Create price for the product
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: Math.round(driver.subscription_amount * 100), // Convert to cents
        recurring: {
          interval: convertToStripeInterval(driver.subscription_frequency),
        },
      });

      // Update driver with Stripe product and price IDs
      await supabase
        .from("drivers")
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
        })
        .eq("id", driver.id);
    } else {
      try {
        // Try to get existing Stripe product
        product = await stripe.products.retrieve(driver.stripe_product_id);

        // Update product data in Stripe
        product = await stripe.products.update(driver.stripe_product_id, {
          name: driver.name,
          description: `Driver: ${driver.name} (${driver.truck_number})`,
          metadata: {
            driver_id: driver.id.toString(),
            name: driver.name,
            phone_number: driver.phone_number,
            truck_number: driver.truck_number,
            solo_or_team: driver.solo_or_team,
            company_id: driver.company_id.toString(),
          },
        });

        // Check if we need to update the price
        if (driver.stripe_price_id) {
          const existingPrice = await stripe.prices.retrieve(
            driver.stripe_price_id
          );
          const stripeInterval = convertToStripeInterval(
            driver.subscription_frequency
          );

          if (
            existingPrice.unit_amount !==
              Math.round(driver.subscription_amount * 100) ||
            existingPrice.recurring?.interval !== stripeInterval
          ) {
            // Create new price if amount or frequency changed
            price = await stripe.prices.create({
              product: product.id,
              currency: "usd",
              unit_amount: Math.round(driver.subscription_amount * 100),
              recurring: {
                interval: stripeInterval,
              },
            });

            // Update driver with new price ID
            await supabase
              .from("drivers")
              .update({
                stripe_price_id: price.id,
              })
              .eq("id", driver.id);
          } else {
            price = existingPrice;
          }
        } else {
          // Create new price if none exists
          price = await stripe.prices.create({
            product: product.id,
            currency: "usd",
            unit_amount: Math.round(driver.subscription_amount * 100),
            recurring: {
              interval: convertToStripeInterval(driver.subscription_frequency),
            },
          });

          // Update driver with new price ID
          await supabase
            .from("drivers")
            .update({
              stripe_price_id: price.id,
            })
            .eq("id", driver.id);
        }
      } catch (stripeError) {
        // If product doesn't exist in Stripe, create a new one
        product = await stripe.products.create({
          name: driver.name,
          description: `Driver: ${driver.name} (${driver.truck_number})`,
          metadata: {
            driver_id: driver.id.toString(),
            name: driver.name,
            phone_number: driver.phone_number,
            truck_number: driver.truck_number,
            solo_or_team: driver.solo_or_team,
            company_id: driver.company_id.toString(),
          },
        });

        // Create new price
        price = await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: Math.round(driver.subscription_amount * 100),
          recurring: {
            interval: convertToStripeInterval(driver.subscription_frequency),
          },
        });

        // Update driver with new Stripe IDs
        await supabase
          .from("drivers")
          .update({
            stripe_product_id: product.id,
            stripe_price_id: price.id,
          })
          .eq("id", driver.id);
      }
    }

    return {
      success: true,
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
