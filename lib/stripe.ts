import Stripe from "stripe";

// Initialize Stripe client
export const stripe = (() => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn("STRIPE_SECRET_KEY is not set");
      return null;
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
    return null;
  }
})();

// Helper function to check if Stripe is initialized
export function getStripe() {
  if (!stripe) {
    throw new Error("Stripe is not properly initialized");
  }
  return stripe;
}
