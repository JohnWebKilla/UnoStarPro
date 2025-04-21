import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    })
  : null;

// Initialize Supabase admin client
const supabaseAdmin = createClient();

// Function to calculate string similarity (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Use Levenshtein distance for similarity
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

async function findMatchingStripeProduct(
  driverName: string
): Promise<Stripe.Product | null> {
  if (!stripe) return null;

  const products = await stripe.products.list({ active: true, limit: 100 });
  let bestMatch: { product: Stripe.Product; similarity: number } | null = null;
  const SIMILARITY_THRESHOLD = 0.8; // 80% similarity threshold

  for (const product of products.data) {
    const similarity = calculateSimilarity(driverName, product.name);
    if (
      similarity > SIMILARITY_THRESHOLD &&
      (!bestMatch || similarity > bestMatch.similarity)
    ) {
      bestMatch = { product, similarity };
    }
  }

  return bestMatch?.product || null;
}

export async function handleProductEvent(event: Stripe.Event) {
  if (!stripe) {
    throw new Error("Required services not initialized");
  }

  const object = event.data.object as Stripe.Product;

  switch (event.type) {
    case "product.created":
    case "product.updated":
      await handleProductCreatedOrUpdated(object);
      break;
    case "product.deleted":
      await handleProductDeleted(object);
      break;
  }
}

async function handleProductCreatedOrUpdated(product: Stripe.Product) {
  const supabase = await supabaseAdmin;
  if (!supabase) return;

  // Get the price information for this product
  const prices = await stripe!.prices.list({
    product: product.id,
    active: true,
    limit: 1,
  });

  const price = prices.data[0];

  // Check if we already have a driver with this name
  const { data: existingDrivers } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("name", product.name)
    .maybeSingle();

  // If we found an exact name match, use that driver's ID
  const driverId = existingDrivers?.id;

  // Update or create the driver record
  const { error } = await supabase.from("drivers").upsert(
    {
      id: driverId, // Will be ignored if no match found
      stripe_product_id: product.id,
      name: product.name,
      description: product.description || null,
      active: product.active,
      stripe_price_id: price?.id || null,
      price_amount: price?.unit_amount || null,
      price_currency: price?.currency || null,
      metadata: product.metadata,
      last_synced_at: new Date().toISOString(),
      subscription: {
        status: "connected",
        info: "Successfully connected to Stripe",
      },
    },
    {
      onConflict: driverId ? "id" : "stripe_product_id",
    }
  );

  if (error) {
    console.error("Error syncing product to driver:", error);
    throw error;
  }
}

async function handleProductDeleted(product: Stripe.Product) {
  const supabase = await supabaseAdmin;
  if (!supabase) return;

  // Soft delete the driver by marking it as inactive and disconnected
  const { error } = await supabase
    .from("drivers")
    .update({
      active: false,
      last_synced_at: new Date().toISOString(),
      subscription: {
        status: "disconnected",
        info: "Product deleted from Stripe",
      },
    })
    .eq("stripe_product_id", product.id);

  if (error) {
    console.error("Error handling product deletion:", error);
    throw error;
  }
}

// Function to sync a driver with Stripe
export async function syncDriverWithStripe(driver: {
  id: string;
  name: string;
  description?: string | null;
  subscription_amount?: number;
}) {
  if (!stripe) throw new Error("Stripe is not initialized");

  try {
    // First, try to find a matching product in Stripe
    const matchingProduct = await findMatchingStripeProduct(driver.name);
    const supabase = await supabaseAdmin;
    if (!supabase) return;

    if (matchingProduct) {
      // Update the driver with the matching Stripe product ID
      const { error } = await supabase
        .from("drivers")
        .update({
          stripe_product_id: matchingProduct.id,
          last_synced_at: new Date().toISOString(),
          subscription: {
            status: "connected",
            info: "Successfully connected to existing Stripe product",
          },
        })
        .eq("id", driver.id);

      if (error) {
        console.error("Error updating driver with matching product:", error);
        throw error;
      }

      return matchingProduct;
    }

    // If no match found, create a new product in Stripe
    const product = await stripe.products.create({
      name: driver.name,
      description: driver.description || undefined,
      metadata: {
        driver_id: driver.id,
      },
    });

    // If subscription amount is provided, create a price
    if (driver.subscription_amount) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: driver.subscription_amount,
        currency: "usd",
        recurring: {
          interval: "month",
        },
      });

      // Update driver with product and price information
      await supabase
        .from("drivers")
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
          last_synced_at: new Date().toISOString(),
          subscription: {
            status: "connected",
            info: "Successfully created new Stripe product and price",
            amount: driver.subscription_amount,
          },
        })
        .eq("id", driver.id);
    } else {
      // Update driver with just the product information
      await supabase
        .from("drivers")
        .update({
          stripe_product_id: product.id,
          last_synced_at: new Date().toISOString(),
          subscription: {
            status: "connected",
            info: "Successfully created new Stripe product",
          },
        })
        .eq("id", driver.id);
    }

    return product;
  } catch (error) {
    // Update driver with error status
    const supabase = await supabaseAdmin;
    if (supabase) {
      await supabase
        .from("drivers")
        .update({
          subscription: {
            status: "disconnected",
            info:
              error instanceof Error
                ? error.message
                : "Failed to connect to Stripe",
          },
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", driver.id);
    }
    throw error;
  }
}
