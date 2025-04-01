import { Driver } from "@/app/(protected)/Drivers/types";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/client";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

// Initialize Stripe with your API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Create a Supabase client instance
const supabase = createClient();

export async function updateDriverInStripe(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    if (!driver.stripe_connect_account_id) {
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

export async function handleDatabaseChange(driver: Driver) {
  // Only sync if the driver has a Stripe Connect account
  if (driver?.stripe_connect_account_id) {
    try {
      await updateDriverInStripe(driver);
    } catch (error) {
      console.error("Error syncing to Stripe:", error);
    }
  }
}

export async function syncStripeConnectAccounts() {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

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

    return {
      success: true,
      message: `Synced ${syncedCount} and created ${createdCount} drivers from Stripe`,
    };
  } catch (error) {
    console.error("Error syncing Stripe Connect accounts:", error);
    throw error;
  }
}

export async function syncStripeConnectAccount(driverId: number) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

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
    account = await stripe.accounts.create({
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
      account = await stripe.accounts.create({
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

      // Update driver with new Stripe Connect account ID
      await supabase
        .from("drivers")
        .update({
          stripe_connect_account_id: account.id,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", driver.id);
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

  return {
    account,
    product: driverProduct || null,
  };
}
