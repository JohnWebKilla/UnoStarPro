import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addStripeConnectColumns() {
  try {
    console.log("Adding Stripe Connect columns to drivers table...");

    // First, let's get a driver to check if we need to update the schema
    const { data: driver, error: checkError } = await supabase
      .from("drivers")
      .select(
        "subscription_frequency, stripe_price_id, stripe_connect_account_id"
      )
      .limit(1)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 means column doesn't exist, which is expected
      throw checkError;
    }

    // If any of these fields are undefined, we need to update the schema
    const needsUpdate =
      !driver ||
      !driver.subscription_frequency ||
      !driver.stripe_price_id ||
      !driver.stripe_connect_account_id;

    if (needsUpdate) {
      // Update all existing drivers with default values
      const { error: updateError } = await supabase
        .from("drivers")
        .update({
          subscription_frequency: "monthly",
          stripe_price_id: null,
          stripe_connect_account_id: null,
        })
        .neq("id", 0); // This will update all rows

      if (updateError) {
        throw updateError;
      }

      console.log("Successfully added Stripe Connect columns!");
    } else {
      console.log("Stripe Connect columns already exist!");
    }
  } catch (error) {
    console.error("Error adding columns:", error);
    process.exit(1);
  }
}

// Run the migration
addStripeConnectColumns()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
