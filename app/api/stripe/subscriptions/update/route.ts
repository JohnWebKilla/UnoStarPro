import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { batchInvalidateCompanyData } from "@/app/(protected)/Companies/server-actions";

interface SubscriptionItem {
  priceId: string;
  quantity: number;
}

interface UpdateRequest {
  subscriptionId: string;
  items: SubscriptionItem[];
}

/**
 * Retry wrapper for Stripe API calls with exponential backoff
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay between retries in ms
 * @returns Result of the operation
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 300
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.warn(
        `Stripe API attempt ${attempt + 1} failed: ${error.message}`
      );
      lastError = error;

      // Only retry if this is a retryable error type
      if (
        error.type === "StripeAPIError" ||
        error.type === "StripeConnectionError"
      ) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 100;
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, 3000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // For other types of errors, don't retry
      throw error;
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  const metrics = {
    startTime: Date.now(),
    stripeRetrieveTime: 0,
    stripeUpdateTime: 0,
    databaseTime: 0,
    cacheInvalidationTime: 0,
    totalTime: 0,
    retries: {
      stripeRetrieve: 0,
      stripeUpdate: 0,
    },
  };

  try {
    // Parse the request body
    const body = (await request.json()) as UpdateRequest;
    const { subscriptionId, items } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    console.log(`Processing subscription update for ID: ${subscriptionId}`);

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    // Get existing subscription to check current items
    const stripeRetrieveStart = Date.now();
    const existingSubscription = await withRetry(async () => {
      metrics.retries.stripeRetrieve++;
      if (!stripe) throw new Error("Stripe is not configured");
      return await stripe.subscriptions.retrieve(subscriptionId);
    });
    metrics.stripeRetrieveTime = Date.now() - stripeRetrieveStart;

    console.log(
      `Retrieved existing subscription with ${existingSubscription.items.data.length} items in ${metrics.stripeRetrieveTime}ms`
    );
    console.log(`Client requested update to ${items.length} items`);

    // First, collect all the current subscription items
    const currentItems = existingSubscription.items.data;

    // Create an array to hold our update operations
    const itemsToUpdate: any[] = [];

    // Handle items to add or update
    items.forEach((item) => {
      // Find if this price is already in the subscription
      const existingItem = currentItems.find(
        (subItem) => subItem.price.id === item.priceId
      );

      if (existingItem) {
        // Skip update if quantity hasn't changed
        if (existingItem.quantity === item.quantity) {
          console.log(
            `Skipping item ${item.priceId} as quantity unchanged (${item.quantity})`
          );
          return;
        }

        // Update quantity of existing item
        itemsToUpdate.push({
          id: existingItem.id,
          quantity: item.quantity,
        });
      } else {
        // Add new item
        itemsToUpdate.push({
          price: item.priceId,
          quantity: item.quantity,
        });
      }
    });

    // Handle items to delete (present in current subscription but not in updated items list)
    currentItems.forEach((existingItem) => {
      const stillExists = items.some(
        (item) => item.priceId === existingItem.price.id
      );

      if (!stillExists) {
        // Mark item for deletion
        itemsToUpdate.push({
          id: existingItem.id,
          deleted: true,
        });
      }
    });

    // If no changes are needed, return early
    if (itemsToUpdate.length === 0) {
      console.log("No subscription changes needed, returning early");
      metrics.totalTime = Date.now() - metrics.startTime;

      return NextResponse.json({
        success: true,
        message: "No subscription changes needed",
        subscription: existingSubscription,
        metrics,
      });
    }

    console.log(
      `Updating subscription with ${itemsToUpdate.length} operations`,
      itemsToUpdate
    );

    // Update subscription in Stripe with the complete set of operations
    const stripeUpdateStart = Date.now();
    const subscription = await withRetry(async () => {
      metrics.retries.stripeUpdate++;
      if (!stripe) throw new Error("Stripe is not configured");
      return await stripe.subscriptions.update(subscriptionId, {
        items: itemsToUpdate,
      });
    });
    metrics.stripeUpdateTime = Date.now() - stripeUpdateStart;
    console.log(`Stripe update completed in ${metrics.stripeUpdateTime}ms`);

    // Get the company associated with this subscription's customer
    const dbStart = Date.now();
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select()
      .eq("stripe_customer_id", existingSubscription.customer as string)
      .single();

    if (companyError || !company) {
      throw new Error(
        `Company not found for customer ${existingSubscription.customer}`
      );
    }

    // Calculate total subscription amount from all items
    const subscriptionAmount = subscription.items.data.reduce(
      (total: number, item: Stripe.SubscriptionItem) => {
        return total + (item.price?.unit_amount || 0) * (item.quantity || 1);
      },
      0
    );

    console.log(
      `Calculated total subscription amount: ${subscriptionAmount} for company ${company.id}`
    );

    // Check if the subscription amount has actually changed to avoid unnecessary database updates
    const hasAmountChanged = company.subscription_amount !== subscriptionAmount;
    const hasSubscriptionIdChanged =
      company.stripe_subscription_id !== subscription.id;

    // Only update the database if something has changed
    if (hasAmountChanged || hasSubscriptionIdChanged) {
      console.log(
        `Updating company database record with new subscription data`
      );

      // Update company subscription amount in database
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          subscription_amount: subscriptionAmount,
          stripe_subscription_id: subscription.id, // Ensure this is always up to date
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      console.log(
        `No changes detected in subscription amount or ID, skipping database update`
      );
    }
    metrics.databaseTime = Date.now() - dbStart;

    // Properly invalidate all caches to ensure data consistency
    const cacheStart = Date.now();
    await batchInvalidateCompanyData(company.id);
    metrics.cacheInvalidationTime = Date.now() - cacheStart;

    metrics.totalTime = Date.now() - metrics.startTime;
    console.log(
      `Updated subscription successfully: ${subscription.id} (total time: ${metrics.totalTime}ms)`
    );
    console.log(`Performance metrics:`, metrics);

    return NextResponse.json({
      success: true,
      subscription,
      company: {
        id: company.id,
        subscription_amount: subscriptionAmount,
      },
      metrics,
    });
  } catch (error: any) {
    metrics.totalTime = Date.now() - metrics.startTime;

    // Categorize error for better client-side handling
    let errorType = "unknown";
    let status = 500;

    if (error.type && error.type.startsWith("Stripe")) {
      errorType = "stripe";

      // Map common Stripe error types to appropriate HTTP status codes
      if (error.type === "StripeCardError") status = 400;
      if (error.type === "StripeInvalidRequestError") status = 400;
      if (error.type === "StripeAuthenticationError") status = 401;
      if (error.type === "StripeRateLimitError") status = 429;
    } else if (error.code && error.code.startsWith("PGRST")) {
      errorType = "database";
    }

    console.error(
      `Error updating subscription (total time: ${metrics.totalTime}ms):`,
      {
        message: error.message,
        type: errorType,
        details: error,
      }
    );

    return NextResponse.json(
      {
        error: "Failed to update subscription",
        errorType,
        details: error.message,
        metrics,
      },
      { status }
    );
  }
}
