/**
 * This script can be used to fix payment method data in your database
 * Run it with: npx ts-node -r tsconfig-paths/register scripts/fix_payment_method.tsx COMPANY_ID
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Get command line arguments
const companyId = parseInt(process.argv[2], 10);

if (!companyId || isNaN(companyId)) {
  console.error("Please provide a valid company ID");
  console.log(
    "Usage: npx ts-node -r tsconfig-paths/register scripts/fix_payment_method.tsx COMPANY_ID"
  );
  process.exit(1);
}

async function fixPaymentMethod(companyId: number) {
  console.log(`Running payment method fix for company ID: ${companyId}`);

  // Initialize Stripe and Supabase
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Step 1: Get company information
    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      console.error("Error fetching company:", error);
      process.exit(1);
    }

    console.log("Company data:", {
      id: company.id,
      name: company.name,
      stripe_customer_id: company.stripe_customer_id,
      stripe_payment_method_id: company.stripe_payment_method_id,
    });

    if (!company.stripe_customer_id) {
      console.error("Company doesn't have a Stripe customer ID");
      process.exit(1);
    }

    // Step 2: Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: company.stripe_customer_id,
      type: "card",
    });

    console.log(
      `Found ${paymentMethods.data.length} payment methods in Stripe`
    );

    if (paymentMethods.data.length > 0) {
      // Show all payment methods
      paymentMethods.data.forEach((pm, index) => {
        console.log(
          `[${index + 1}] ${pm.id} - ${pm.card?.brand} ending in ${pm.card?.last4}`
        );
      });

      // Auto-select the first payment method
      const selectedPaymentMethod = paymentMethods.data[0];
      console.log(`\nSelected payment method: ${selectedPaymentMethod.id}`);

      // Step 3: Update the company record with the selected payment method
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          stripe_payment_method_id: selectedPaymentMethod.id,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (updateError) {
        console.error("Error updating payment method:", updateError);
        process.exit(1);
      }

      console.log("Successfully updated payment method ID");
    } else {
      console.log("No payment methods found in Stripe");

      // Ask if user wants to set a placeholder value
      console.log(
        "Would you like to set a placeholder payment method ID to fix the UI? (y/n)"
      );
      process.stdin.once("data", async (input) => {
        const answer = input.toString().trim().toLowerCase();

        if (answer === "y" || answer === "yes") {
          const { error: updateError } = await supabase
            .from("companies")
            .update({
              stripe_payment_method_id: "pending_payment_setup",
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", companyId);

          if (updateError) {
            console.error("Error updating payment method:", updateError);
            process.exit(1);
          }

          console.log("Successfully set placeholder payment method ID");
        } else {
          console.log("No changes were made");
        }

        process.exit(0);
      });
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the function
fixPaymentMethod(companyId);
