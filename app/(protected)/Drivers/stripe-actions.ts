"use server";

import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";
import { Driver, SubscriptionFrequency } from "./types";
import { revalidatePath } from "next/cache";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as const,
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
      driver_id: String(driver.id),
      name: driver.name || null,
      phone_number: driver.phone_number || null,
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
        driver_id: String(driver.id),
        name: driver.name || null,
        phone_number: driver.phone_number || null,
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
    unit_amount: Math.round((driver.subscription_amount || 0) * 100), // Convert to cents
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
  driverId: string,
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

  // Get subscription amount, defaulting to 0
  const subscriptionAmount = driver.subscription_amount || 0;

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
      application_fee_amount: Math.round(subscriptionAmount * 100 * 0.1), // 10% platform fee
      transfer_data: {
        destination: driver.stripe_connect_account_id,
      },
    },
  });

  return session.url;
}

export async function getStripeAccountStatusAction(driverId: string) {
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

export async function createStripeConnectAccountAction(driverId: string) {
  const supabase = await createClient();

  // Get driver data
  const { data: driverData } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();

  if (!driverData) {
    throw new Error("Driver not found");
  }

  // Convert database result to Driver type
  const driver: Driver = {
    id: driverData.id,
    name: driverData.name,
    phone: driverData.phone || "",
    phone_number: driverData.phone_number || "",
    truckNumber: driverData.truck_number || "",
    truck_number: driverData.truck_number,
    type: (driverData.solo_or_team || "solo") as "solo" | "team",
    solo_or_team: driverData.solo_or_team,
    status: driverData.status as
      | "active"
      | "inactive"
      | "terminated"
      | "pending",
    documents: [],
    subscription: {
      id: driverData.stripe_connect_account_id || "",
      status: "disconnected",
      amount: driverData.subscription_amount || 0,
      info: "",
    },
    subscription_amount: driverData.subscription_amount || 0,
    subscription_frequency: driverData.subscription_frequency,
    stripe_product_id: driverData.stripe_product_id,
    stripe_price_id: driverData.stripe_price_id,
    stripe_connect_account_id: driverData.stripe_connect_account_id,
    company_id: driverData.company_id,
    createdAt: driverData.created_at || new Date().toISOString(),
    updatedAt: driverData.updated_at || new Date().toISOString(),
  };

  // Create the Stripe Connect account using the working function
  const account = await createStripeConnectAccount(driver);

  // Create an account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?onboarding=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/drivers/${driverId}?onboarding=complete`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

interface NameMatchSuggestion {
  stripeProduct: Stripe.Product;
  dbDriver: Driver;
  similarity: number;
}

async function getAllStripeProducts(): Promise<Stripe.Product[]> {
  const allProducts: Stripe.Product[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const response: Stripe.Response<Stripe.ApiList<Stripe.Product>> =
      await stripe.products.list({
        active: true,
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.metadata"],
      });

    allProducts.push(...response.data);
    hasMore = response.has_more;
    startingAfter = response.data[response.data.length - 1]?.id;

    if (hasMore) {
      // Add a small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allProducts;
}

export async function syncStripeProductsWithNameMatching() {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  try {
    // Get all drivers from our database
    const { data: dbDrivers, error: dbError } = await supabase
      .from("drivers")
      .select("*");

    if (dbError) throw dbError;
    if (!dbDrivers) throw new Error("No drivers found in database");

    console.log("Fetched drivers from database:", dbDrivers.length);

    // Get all products from Stripe with pagination
    const stripeProducts = await getAllStripeProducts();
    console.log("Fetched all products from Stripe:", stripeProducts.length);

    const suggestions: NameMatchSuggestion[] = [];
    const exactMatches: { [key: string]: boolean } = {};

    // Process in batches to avoid timeouts
    const batchSize = 50;

    // First pass: Handle exact matches and existing connections
    for (let i = 0; i < dbDrivers.length; i += batchSize) {
      const batch = dbDrivers.slice(i, i + batchSize);
      console.log(
        `Processing batch ${i / batchSize + 1} of ${Math.ceil(dbDrivers.length / batchSize)}`
      );

      await Promise.all(
        batch.map(async (dbDriver) => {
          // Skip if driver already has a Stripe product ID and it exists in Stripe
          if (dbDriver.stripe_product_id) {
            const stripeProduct = stripeProducts.find(
              (p) => p.id === dbDriver.stripe_product_id
            );
            if (stripeProduct) {
              exactMatches[stripeProduct.id] = true;
              console.log(
                `Found existing connection for driver ${dbDriver.name}`
              );
              return;
            }
          }

          // Look for exact name match in Stripe
          const exactMatch = stripeProducts.find((product) => {
            const productName = product.name.toLowerCase().trim();
            const driverName = dbDriver.name.toLowerCase().trim();
            return (
              productName === driverName ||
              productName === `Driver Service - ${driverName}` ||
              productName.replace(/[^a-z0-9]/g, "") ===
                driverName.replace(/[^a-z0-9]/g, "")
            );
          });

          if (exactMatch) {
            console.log(`Found exact match for driver ${dbDriver.name}`);
            // Update driver with Stripe product ID
            await supabase
              .from("drivers")
              .update({
                stripe_product_id: exactMatch.id,
                last_synced_at: new Date().toISOString(),
              })
              .eq("id", dbDriver.id);

            exactMatches[exactMatch.id] = true;
          }
        })
      );

      // Add a small delay between batches
      if (i + batchSize < dbDrivers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Second pass: Find similar names for user approval
    for (let i = 0; i < dbDrivers.length; i += batchSize) {
      const batch = dbDrivers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (dbDriver) => {
          if (dbDriver.stripe_product_id) return;

          for (const stripeProduct of stripeProducts) {
            if (exactMatches[stripeProduct.id]) continue;

            // Clean up names for comparison
            const cleanStripeProduct = stripeProduct.name
              .toLowerCase()
              .replace(/^driver service -/, "")
              .trim();
            const cleanDriverName = dbDriver.name.toLowerCase().trim();

            const similarity = calculateNameSimilarity(
              cleanDriverName,
              cleanStripeProduct
            );

            // If names are similar but not exact matches
            if (similarity > 0.7 && similarity < 1) {
              console.log(
                `Found similar match: ${cleanDriverName} <-> ${cleanStripeProduct} (${similarity})`
              );
              suggestions.push({
                stripeProduct,
                dbDriver,
                similarity,
              });
            }
          }
        })
      );

      // Add a small delay between batches
      if (i + batchSize < dbDrivers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Third pass: Create missing products in Stripe
    for (let i = 0; i < dbDrivers.length; i += batchSize) {
      const batch = dbDrivers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (dbDriver) => {
          if (dbDriver.stripe_product_id) return;

          const matchingSuggestion = suggestions.find(
            (s) => s.dbDriver.id === dbDriver.id
          );

          if (!matchingSuggestion) {
            console.log(
              `Creating new Stripe product for driver ${dbDriver.name}`
            );
            // Create new product in Stripe
            const newProduct = await stripe.products.create({
              name: `Driver Service - ${dbDriver.name}`,
              description: `Driver service subscription for ${dbDriver.name}`,
              metadata: {
                driver_id: String(dbDriver.id),
                phone_number: dbDriver.phone_number || "",
              },
            });

            // Update driver with new Stripe product ID
            await supabase
              .from("drivers")
              .update({
                stripe_product_id: newProduct.id,
                last_synced_at: new Date().toISOString(),
              })
              .eq("id", dbDriver.id);
          }
        })
      );

      // Add a small delay between batches
      if (i + batchSize < dbDrivers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Fourth pass: Create missing drivers in our DB
    for (let i = 0; i < stripeProducts.length; i += batchSize) {
      const batch = stripeProducts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (stripeProduct) => {
          if (exactMatches[stripeProduct.id]) return;

          const matchingSuggestion = suggestions.find(
            (s) => s.stripeProduct.id === stripeProduct.id
          );

          if (!matchingSuggestion) {
            const driverName = stripeProduct.name
              .replace(/^Driver Service -/, "")
              .trim();
            console.log(`Creating new driver for Stripe product ${driverName}`);

            // Create new driver in our DB
            await supabase.from("drivers").insert({
              name: driverName,
              stripe_product_id: stripeProduct.id,
              phone_number: stripeProduct.metadata?.phone_number || null,
              status: "pending",
              last_synced_at: new Date().toISOString(),
            });
          }
        })
      );

      // Add a small delay between batches
      if (i + batchSize < stripeProducts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Sort suggestions by similarity score
    suggestions.sort((a, b) => b.similarity - a.similarity);

    const message =
      suggestions.length > 0
        ? `Found ${suggestions.length} potential matches for review.`
        : `Sync completed successfully. Processed ${dbDrivers.length} drivers and ${stripeProducts.length} Stripe products.`;

    return {
      success: true,
      suggestions,
      message,
    };
  } catch (error) {
    console.error("Error syncing Stripe products:", error);
    throw error;
  }
}

// Helper function to calculate name similarity using Levenshtein distance
function calculateNameSimilarity(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[str1.length][str2.length];
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

// Function to approve and apply a suggested match
export async function approveStripeProductMatch(
  driverId: number,
  stripeProductId: string
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  try {
    // Update driver with approved Stripe product ID
    await supabase
      .from("drivers")
      .update({
        stripe_product_id: stripeProductId,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", driverId);

    // Update Stripe product metadata
    const { data: driver } = await supabase
      .from("drivers")
      .select()
      .eq("id", driverId)
      .single();

    if (driver) {
      await stripe.products.update(stripeProductId, {
        metadata: {
          driver_id: String(driver.id),
          phone_number: driver.phone_number || "",
        },
      });
    }

    return {
      success: true,
      message: "Match approved and applied successfully",
    };
  } catch (error) {
    console.error("Error approving Stripe product match:", error);
    throw error;
  }
}

// Helper function to handle Stripe API calls with retries
async function retryStripeOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (!error.type || error.type !== "StripeConnectionError") {
        throw error;
      }
      console.warn(
        `Stripe API call failed (attempt ${attempt}/${maxRetries}):`,
        error.message
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * Math.pow(2, attempt - 1))
        );
      }
    }
  }
  throw lastError;
}

// Function to sync all drivers with Stripe
export async function syncStripeProducts() {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables."
    );
  }

  const supabase = await createClient();

  try {
    // Get all drivers without Stripe IDs first
    const { data: driversWithoutStripe } = await supabase
      .from("drivers")
      .select("*")
      .is("stripe_product_id", null);

    // Create Stripe products for drivers that don't have one
    if (driversWithoutStripe) {
      for (const driver of driversWithoutStripe) {
        await createStripeProduct(driver);
      }
    }

    // Get all Stripe products
    const products = await stripe.products.list({
      limit: 100,
      expand: ["data.default_price"],
    });

    let syncedCount = 0;
    let createdCount = 0;

    for (const product of products.data) {
      // Find driver by Stripe product ID
      const { data: existingDriver } = await supabase
        .from("drivers")
        .select()
        .eq("stripe_product_id", product.id)
        .single();

      const driverData = {
        name: product.name,
        description: product.description,
        stripe_product_id: product.id,
        stripe_price_id: (product.default_price as Stripe.Price)?.id || null,
        price_amount:
          (product.default_price as Stripe.Price)?.unit_amount || null,
        price_currency:
          (product.default_price as Stripe.Price)?.currency || "usd",
        active: product.active,
        metadata: product.metadata,
        last_synced_at: new Date().toISOString(),
        subscription: {
          status: "connected",
          info: "Successfully synced with Stripe",
        },
      };

      if (existingDriver) {
        // Update existing driver
        await supabase
          .from("drivers")
          .update(driverData)
          .eq("id", existingDriver.id);
        syncedCount++;
      } else {
        // Create new driver from Stripe product
        await supabase.from("drivers").insert({
          ...driverData,
          status: "active",
        });
        createdCount++;
      }
    }

    revalidatePath("/Drivers");
    return {
      success: true,
      message: `Synced ${syncedCount} and created ${createdCount} drivers from Stripe`,
    };
  } catch (error) {
    console.error("Error syncing Stripe products:", error);
    throw error;
  }
}

// Function to create a new Stripe product for a driver
async function createStripeProduct(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Create a new product in Stripe with retry logic
  const product = await retryStripeOperation(() =>
    stripe.products.create({
      name: driver.name,
      description: driver.description || undefined,
      metadata: {
        driver_id: driver.id.toString(),
      },
    })
  );

  // If driver has a subscription amount, create a price
  let price: Stripe.Price | null = null;
  if (driver.subscription_amount) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: driver.subscription_amount,
      currency: "usd",
      recurring: {
        interval: "month",
      },
    });
  }

  // Update driver with Stripe IDs
  const supabase = await createClient();
  await supabase
    .from("drivers")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price?.id || null,
      last_synced_at: new Date().toISOString(),
      subscription: {
        status: "connected",
        info: "Successfully created Stripe product",
      },
    })
    .eq("id", driver.id);

  return product;
}

// Function to sync a single driver with Stripe
export async function syncStripeProduct(driverId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  try {
    const { data: driver } = await supabase
      .from("drivers")
      .select()
      .eq("id", driverId)
      .single();

    if (!driver) {
      throw new Error("Driver not found");
    }

    let product: Stripe.Product;

    if (!driver.stripe_product_id) {
      // Create new product in Stripe
      product = await createStripeProduct(driver);
    } else {
      try {
        // Try to get existing Stripe product
        const stripeProduct = await stripe.products.retrieve(
          driver.stripe_product_id,
          {
            expand: ["default_price"],
          }
        );

        if (stripeProduct.deleted) {
          // If product was deleted in Stripe, create a new one
          product = await createStripeProduct(driver);
        } else {
          product = stripeProduct;
          // Update product data in Stripe to match our database
          await stripe.products.update(product.id, {
            name: driver.name,
            description: driver.description || undefined,
            metadata: {
              driver_id: driver.id.toString(),
            },
          });
        }
      } catch (error) {
        // If product doesn't exist in Stripe, create a new one
        product = await createStripeProduct(driver);
      }
    }

    // Update driver with latest Stripe data
    await supabase
      .from("drivers")
      .update({
        stripe_product_id: product.id,
        stripe_price_id: (product.default_price as Stripe.Price)?.id || null,
        price_amount:
          (product.default_price as Stripe.Price)?.unit_amount || null,
        price_currency:
          (product.default_price as Stripe.Price)?.currency || "usd",
        active: product.active,
        last_synced_at: new Date().toISOString(),
        subscription: {
          status: "connected",
          info: "Successfully synced with Stripe",
        },
      })
      .eq("id", driverId);

    revalidatePath("/Drivers");
    return { success: true, message: "Product synced successfully" };
  } catch (error) {
    // Update driver with error status
    const supabase = await createClient();
    if (supabase) {
      await supabase
        .from("drivers")
        .update({
          subscription: {
            status: "disconnected",
            info:
              error instanceof Error
                ? error.message
                : "Failed to sync with Stripe",
          },
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", driverId);
    }
    console.error("Error syncing Stripe product:", error);
    throw error;
  }
}
