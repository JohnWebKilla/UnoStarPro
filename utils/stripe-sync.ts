import { Company } from "@/app/(protected)/Companies/types";
import { Driver } from "@/app/(protected)/Drivers/types";
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

export async function syncDriverToStripe(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    let product: Stripe.Product;

    if (driver.stripe_product_id) {
      // Update existing product
      product = await stripe.products.update(driver.stripe_product_id, {
        name: driver.name,
        description: driver.description || undefined,
        active: driver.active,
        metadata: {
          driver_id: driver.id.toString(),
          ...driver.metadata,
        },
      });
    } else {
      // Create new product
      product = await stripe.products.create({
        name: driver.name,
        description: driver.description || undefined,
        active: driver.active,
        metadata: {
          driver_id: driver.id.toString(),
          ...driver.metadata,
        },
      });

      // Create price if amount is set
      if (driver.price_amount) {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: driver.price_amount,
          currency: driver.price_currency || "usd",
          active: true,
        });

        // Update driver with Stripe IDs
        const supabase = await createClient();
        await supabase
          .from("drivers")
          .update({
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", driver.id);
      }
    }

    return {
      success: true,
      message: "Driver synced with Stripe successfully",
      productId: product.id,
    };
  } catch (error) {
    console.error("Error syncing driver to Stripe:", error);
    throw error;
  }
}

export async function deleteDriverFromStripe(driver: Driver) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  if (!driver.stripe_product_id) {
    return; // Nothing to delete in Stripe
  }

  try {
    // Archive the product instead of deleting it
    await stripe.products.update(driver.stripe_product_id, {
      active: false,
    });

    // Update driver record
    const supabase = await createClient();
    await supabase
      .from("drivers")
      .update({
        active: false,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    return {
      success: true,
      message: "Driver archived in Stripe successfully",
    };
  } catch (error) {
    console.error("Error archiving driver in Stripe:", error);
    throw error;
  }
}
