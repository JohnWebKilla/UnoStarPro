import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { revalidateTag } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Add a flag to the request to indicate it's from a webhook
const WEBHOOK_UPDATE_HEADER = "x-webhook-update";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    const supabase = await createClient();

    switch (event.type) {
      case "product.updated": {
        const product = event.data.object as Stripe.Product;
        const driverId = product.metadata.driver_id;

        if (driverId) {
          const { error } = await supabase
            .from("drivers")
            .update({
              name: product.name,
              stripe_product_id: product.id,
              webhook_update: true,
            })
            .eq("id", driverId)
            .select()
            .single();

          if (error) throw error;

          // Revalidate the drivers cache
          revalidateTag("drivers");
        }
        break;
      }

      case "price.updated":
      case "price.created": {
        const price = event.data.object as Stripe.Price;
        const product = await stripe.products.retrieve(price.product as string);
        const driverId = product.metadata.driver_id;

        if (driverId && price.recurring) {
          const { error } = await supabase
            .from("drivers")
            .update({
              subscription_amount: price.unit_amount! / 100,
              subscription_frequency:
                price.recurring.interval === "month" ? "monthly" : "weekly",
              stripe_price_id: price.id,
              webhook_update: true,
            })
            .eq("id", driverId)
            .select()
            .single();

          if (error) throw error;

          // Revalidate the drivers cache
          revalidateTag("drivers");
        }
        break;
      }

      case "product.deleted": {
        const product = event.data.object as Stripe.Product;
        const driverId = product.metadata.driver_id;

        if (driverId) {
          const { error } = await supabase
            .from("drivers")
            .update({
              stripe_product_id: null,
              stripe_price_id: null,
              webhook_update: true,
            })
            .eq("id", driverId)
            .select()
            .single();

          if (error) throw error;

          // Revalidate the drivers cache
          revalidateTag("drivers");
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      {
        error: "Webhook handler failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
