import { serve } from "https://deno.fresh.dev/std@v9.6.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.14.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );

    // Handle different event types
    switch (event.type) {
      case "product.updated": {
        const product = event.data.object as Stripe.Product;
        const driverId = product.metadata.driver_id;

        if (driverId) {
          // Update driver's product details
          const { error } = await supabase
            .from("drivers")
            .update({
              stripe_product_id: product.id,
              name: product.name, // Only update if you want Stripe to be source of truth
            })
            .eq("id", driverId);

          if (error) throw error;
        }
        break;
      }

      case "price.updated":
      case "price.created": {
        const price = event.data.object as Stripe.Price;
        const product = await stripe.products.retrieve(price.product as string);
        const driverId = product.metadata.driver_id;

        if (driverId) {
          // Update driver's price details
          const { error } = await supabase
            .from("drivers")
            .update({
              stripe_price_id: price.id,
              subscription_amount: price.unit_amount
                ? price.unit_amount / 100
                : 0,
              subscription_frequency:
                price.recurring?.interval === "month" ? "monthly" : "weekly",
            })
            .eq("id", driverId);

          if (error) throw error;
        }
        break;
      }

      case "product.deleted": {
        const product = event.data.object as Stripe.Product;
        const driverId = product.metadata.driver_id;

        if (driverId) {
          // Clear driver's Stripe product and price IDs
          const { error } = await supabase
            .from("drivers")
            .update({
              stripe_product_id: null,
              stripe_price_id: null,
            })
            .eq("id", driverId);

          if (error) throw error;
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
