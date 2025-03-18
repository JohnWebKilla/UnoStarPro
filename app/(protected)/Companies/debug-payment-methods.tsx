import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// This is a debug script to be run manually
// to identify why payment methods aren't syncing correctly

export async function debugPaymentMethods(companyId: number) {
  console.log(`Debugging payment methods for company ID: ${companyId}`);

  try {
    // 1. Initialize Stripe with your API key
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });

    // 2. Connect to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Get company info
    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      console.error("Error fetching company:", error);
      return { error: "Company not found" };
    }

    console.log("Company data:", {
      id: company.id,
      name: company.name,
      stripe_customer_id: company.stripe_customer_id,
      stripe_payment_method_id: company.stripe_payment_method_id,
    });

    if (!company.stripe_customer_id) {
      return { error: "Company doesn't have a Stripe customer ID" };
    }

    // 4. Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: company.stripe_customer_id,
      type: "card",
    });

    console.log(
      `Found ${paymentMethods.data.length} payment methods in Stripe`
    );

    // 5. List all payment methods
    const paymentMethodsData = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      last4: pm.card?.last4,
      brand: pm.card?.brand,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
    }));

    console.log("Payment methods:", paymentMethodsData);

    // 6. Get default payment method
    let defaultPaymentMethodId = null;

    // Get customer details to check default payment method
    const customer = await stripe.customers.retrieve(
      company.stripe_customer_id,
      { expand: ["invoice_settings.default_payment_method"] }
    );

    if (
      (customer as Stripe.Customer).invoice_settings?.default_payment_method
    ) {
      if (
        typeof (customer as Stripe.Customer).invoice_settings
          .default_payment_method === "string"
      ) {
        defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings
          .default_payment_method;
      } else if (
        (customer as Stripe.Customer).invoice_settings.default_payment_method
      ) {
        defaultPaymentMethodId = (
          (customer as Stripe.Customer).invoice_settings
            .default_payment_method as any
        ).id;
      }
    } else if (paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id;
    }

    console.log("Default payment method:", defaultPaymentMethodId);

    // 7. Update the payment method ID in the database if needed
    if (
      defaultPaymentMethodId &&
      company.stripe_payment_method_id !== defaultPaymentMethodId
    ) {
      console.log(
        `Updating payment method ID from ${company.stripe_payment_method_id} to ${defaultPaymentMethodId}`
      );

      const { error: updateError } = await supabase
        .from("companies")
        .update({ stripe_payment_method_id: defaultPaymentMethodId })
        .eq("id", companyId);

      if (updateError) {
        console.error("Error updating payment method ID:", updateError);
        return { error: "Failed to update payment method ID" };
      }

      console.log("Payment method ID updated successfully");
    } else if (!defaultPaymentMethodId) {
      console.log("No payment methods found to set as default");
    } else {
      console.log("Payment method ID is already up to date");
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        stripe_customer_id: company.stripe_customer_id,
        stripe_payment_method_id: company.stripe_payment_method_id,
      },
      paymentMethods: paymentMethodsData,
      defaultPaymentMethodId,
    };
  } catch (error) {
    console.error("Error in debugPaymentMethods:", error);
    return { error: "An unexpected error occurred" };
  }
}
