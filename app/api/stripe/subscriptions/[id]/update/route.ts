import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";
import { cookies } from "next/headers";
import type Stripe from "stripe";

interface SubscriptionItem {
  priceId: string;
  quantity: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const { items } = (await request.json()) as { items: SubscriptionItem[] };

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    // Get existing subscription to check current items
    const existingSubscription = await stripe.subscriptions.retrieve(id);

    // Get the customer ID from the subscription
    const customerId = existingSubscription.customer as string;

    // Prepare items update by matching existing items
    const updatedItems = items.map((item: SubscriptionItem) => {
      // Find if this price is already in use
      const existingItem = existingSubscription.items.data.find(
        (subItem: Stripe.SubscriptionItem) => subItem.price.id === item.priceId
      );

      return {
        id: existingItem?.id, // Include existing item ID if found
        price: item.priceId,
        quantity: item.quantity,
      };
    });

    // Update subscription in Stripe
    const subscription = await stripe.subscriptions.update(id, {
      items: updatedItems,
    });

    // Get the company associated with this subscription's customer
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select()
      .eq("stripe_customer_id", customerId)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found for customer ${customerId}`);
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
