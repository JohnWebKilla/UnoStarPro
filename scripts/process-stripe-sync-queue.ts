import { createClient } from "@supabase/supabase-js";
import { syncDriverToStripe } from "../utils/stripe-sync";
import { Driver } from "@/app/(protected)/Drivers/types";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function processQueue() {
  console.log("Processing Stripe sync queue...");

  try {
    // Get unprocessed jobs
    const { data: jobs, error } = await supabase
      .from("stripe_sync_queue")
      .select("*")
      .is("processed_at", null)
      .lt("retries", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      throw error;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No jobs to process");
      return;
    }

    console.log(`Processing ${jobs.length} jobs`);

    for (const job of jobs) {
      try {
        if (job.record_type === "driver") {
          const driver = job.data as Driver;
          await syncDriverToStripe(driver);
        }

        // Mark job as processed
        await supabase
          .from("stripe_sync_queue")
          .update({
            processed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        console.log(`Successfully processed job ${job.id}`);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);

        // Update retry count
        await supabase
          .from("stripe_sync_queue")
          .update({
            retries: job.retries + 1,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", job.id);
      }
    }
  } catch (error) {
    console.error("Error in queue processing:", error);
  }
}

// Run the processor every minute
async function run() {
  while (true) {
    await processQueue();
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }
}

// Start the processor
if (require.main === module) {
  run().catch(console.error);
}
