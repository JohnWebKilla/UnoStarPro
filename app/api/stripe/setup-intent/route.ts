import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(request: Request) {
  try {
    const { companyId } = await request.json();

    // Get company's Stripe customer ID
    const supabase = await createClient();
    const { data: company, error } = await supabase
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyId)
      .single();

    if (error || !company?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Company not found or not connected to Stripe" },
        { status: 404 }
      );
    }

    // Create a SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: company.stripe_customer_id,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
