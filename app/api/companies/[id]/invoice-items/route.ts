import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", resolvedParams.id)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.stripe_customer_id) {
      return NextResponse.json(
        { error: "Company not connected to Stripe" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, description, metadata } = body;

    // Create invoice item in Stripe
    const invoiceItem = await stripe.invoiceItems.create({
      customer: company.stripe_customer_id,
      amount,
      currency: "usd",
      description,
      metadata,
    });

    return NextResponse.json({ data: invoiceItem });
  } catch (error) {
    console.error("Error creating invoice item:", error);
    return NextResponse.json(
      { error: "Failed to create invoice item" },
      { status: 500 }
    );
  }
}
