import { NextResponse } from "next/server";
import { syncStripeCustomers } from "@/app/(protected)/Companies/stripe-actions";

export async function POST() {
  try {
    const result = await syncStripeCustomers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing companies with Stripe:", error);
    return NextResponse.json(
      {
        error: "Failed to sync companies with Stripe",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
