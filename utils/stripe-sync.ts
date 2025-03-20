import { Company } from "@/app/(protected)/Companies/types";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

// Initialize Stripe with your API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function updateCompanyInStripe(company: Company) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    if (!company.stripe_customer_id) {
      return;
    }

    // Update existing customer in Stripe
    await stripe.customers.update(company.stripe_customer_id, {
      name: company.name,
      email: company.contact_email,
      phone: company.contact_phone,
      metadata: {
        company_id: company.id.toString(),
      },
    });

    return {
      success: true,
      message: "Customer updated in Stripe successfully",
    };
  } catch (error) {
    console.error("Error updating customer in Stripe:", error);
    throw error;
  }
}

export async function handleDatabaseChange(company: Company) {
  // Only sync if the company has a Stripe ID
  if (company?.stripe_customer_id) {
    try {
      await updateCompanyInStripe(company);
    } catch (error) {
      console.error("Error syncing to Stripe:", error);
    }
  }
}
