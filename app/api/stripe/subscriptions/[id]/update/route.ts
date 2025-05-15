import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";

interface SubscriptionItem {
  priceId: string;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    // Extract ID directly from the URL path segments
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // The subscription ID is in the position before "update"
    const updateIndex = segments.indexOf("update");
    const id = segments[updateIndex - 1];

    console.log(`Processing subscription update for ID: ${id}`);

    const { items } = (await request.json()) as { items: SubscriptionItem[] };

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    // Get existing subscription to check current items
    const existingSubscription = await stripe.subscriptions.retrieve(id);

    console.log(
      `Retrieved existing subscription with ${existingSubscription.items.data.length} items`
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

    console.log(
      `Updating subscription with ${itemsToUpdate.length} operations`,
      itemsToUpdate
    );

    // Update subscription in Stripe with the complete set of operations
    const subscription = await stripe.subscriptions.update(id, {
      items: itemsToUpdate,
    });

    // Get the company associated with this subscription's customer
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

    // Revalidate company paths to update UI
    revalidatePath(`/Companies/${company.id}`);
    revalidatePath("/Companies");

    console.log(`Updated subscription successfully: ${subscription.id}`);

    return NextResponse.json({
      success: true,
      subscription,
      company: {
        id: company.id,
        subscription_amount: subscriptionAmount,
      },
    });
  } catch (error: any) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to update subscription",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
