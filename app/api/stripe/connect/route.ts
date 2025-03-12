import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(request: Request) {
  try {
    const { companyId } = await request.json();

    // Get company details from database
    const supabase = await createClient();
    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.contact_email,
      phone: company.contact_phone,
      metadata: {
        company_id: company.id.toString(),
      },
    });

    // Update company with Stripe customer ID
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        stripe_customer_id: customer.id,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    if (updateError) {
      // If we fail to update the database, delete the customer from Stripe
      await stripe.customers.del(customer.id);
      return NextResponse.json(
        { error: "Failed to update company" },
        { status: 500 }
      );
    }

    return NextResponse.json(customer.id);
  } catch (error) {
    console.error("Error connecting to Stripe:", error);
    return NextResponse.json(
      { error: "Failed to connect to Stripe" },
      { status: 500 }
    );
  }
}
