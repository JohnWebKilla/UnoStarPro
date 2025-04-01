"use server";

import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";
import { Driver, SubscriptionFrequency } from "./types";
import { revalidatePath } from "next/cache";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function createStripeConnectAccount(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Create a new Connect account in Stripe
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
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
  const supabase = await createClient();
  await supabase
    .from("drivers")
    .update({
      stripe_connect_account_id: account.id,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", driver.id);

  return account;
}

export async function syncStripeConnectAccounts() {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables."
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
        await createStripeConnectAccount(driver);
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

    revalidatePath("/Drivers");
    return {
      success: true,
      message: `Synced ${syncedCount} and created ${createdCount} drivers from Stripe`,
    };
  } catch (error) {
    console.error("Error syncing Stripe Connect accounts:", error);
    throw error;
  }
}

export async function updateDriverInStripe(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    if (!driver.stripe_connect_account_id) {
      // If driver doesn't have a Stripe Connect account, create one
      await createStripeConnectAccount(driver);
      return;
    }

    // Update existing account in Stripe
    await stripe.accounts.update(driver.stripe_connect_account_id, {
      metadata: {
        driver_id: driver.id.toString(),
        name: driver.name,
        phone_number: driver.phone_number,
      },
    });

    return {
      success: true,
      message: "Driver updated in Stripe successfully",
    };
  } catch (error) {
    console.error("Error updating driver in Stripe:", error);
    throw error;
  }
}

export async function syncStripeConnectAccount(driverId: number) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  // Get driver data
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select()
    .eq("id", driverId)
    .single();

  if (driverError) throw driverError;
  if (!driver) throw new Error("Driver not found");

  let account: Stripe.Account;

  if (!driver.stripe_connect_account_id) {
    // Create new Connect account in Stripe
    account = await createStripeConnectAccount(driver);
  } else {
    try {
      // Try to get existing Stripe Connect account
      account = await stripe.accounts.retrieve(
        driver.stripe_connect_account_id
      );

      // Update account data in Stripe to match our database
      await updateDriverInStripe(driver);
    } catch (error) {
      // If account doesn't exist in Stripe, create a new one
      account = await createStripeConnectAccount(driver);
    }
  }

  // Get all products for this driver
  const products = await stripe.products.list({
    limit: 100,
    expand: ["data.default_price"],
  });

  // Find the driver's product
  const driverProduct = products.data.find(
    (product) => product.metadata.driver_id === driver.id.toString()
  );

  // Create or update product data
  if (driverProduct) {
    // Update existing product
    await stripe.products.update(driverProduct.id, {
      name: `Driver Service - ${driver.name}`,
      description: `Driver service subscription for ${driver.name}`,
      metadata: {
        driver_id: driver.id.toString(),
      },
    });

    // Update driver with product ID
    await supabase
      .from("drivers")
      .update({
        stripe_product_id: driverProduct.id,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", driver.id);
  }

  revalidatePath("/Drivers");
  return {
    account,
    product: driverProduct || null,
  };
}

export async function createOrUpdateDriverProductAction(
  driver: Driver,
  frequency: SubscriptionFrequency
) {
  // Create or update the product in Stripe
  const product = driver.stripe_product_id
    ? await stripe.products.update(driver.stripe_product_id, {
        name: `Driver Service - ${driver.name}`,
        description: `Driver service subscription for ${driver.name}`,
      })
    : await stripe.products.create({
        name: `Driver Service - ${driver.name}`,
        description: `Driver service subscription for ${driver.name}`,
      });

  // Create a new price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(driver.subscription_amount * 100), // Convert to cents
    currency: "usd",
    recurring: {
      interval: frequency === "weekly" ? "week" : "month",
    },
  });

  // Update driver with Stripe product and price IDs
  const supabase = await createClient();
  await supabase
    .from("drivers")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      subscription_frequency: frequency,
    })
    .eq("id", driver.id);

  return { product, price };
}

export async function createCheckoutSessionAction(
  driverId: number,
  priceId: string
) {
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();

  if (!driver || !driver.stripe_connect_account_id) {
    throw new Error("Driver not found or Stripe Connect account not set up");
  }

  // Create a checkout session
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?checkout=canceled`,
    payment_intent_data: {
      application_fee_amount: Math.round(
        driver.subscription_amount * 100 * 0.1
      ), // 10% platform fee
      transfer_data: {
        destination: driver.stripe_connect_account_id,
      },
    },
  });

  return session.url;
}

export async function getStripeAccountStatusAction(driverId: number) {
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();

  if (!driver?.stripe_connect_account_id) {
    return null;
  }

  const account = await stripe.accounts.retrieve(
    driver.stripe_connect_account_id
  );
  return account;
}

export async function createStripeConnectAccountAction(driverId: number) {
  const supabase = await createClient();

  // Get driver data
  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();

  if (!driver) {
    throw new Error("Driver not found");
  }

  // Create a new Connect account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
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

  // Create an account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?onboarding=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?onboarding=complete`,
    type: "account_onboarding",
  });

  return accountLink.url;
}
