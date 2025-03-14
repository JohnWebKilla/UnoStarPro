"use server";

import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Company } from "./types";
import { revalidatePath } from "next/cache";
import { getCachedPaymentMethods, cachePaymentMethods } from "@/lib/redis";

// Initialize Stripe only if the API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    })
  : null;

async function createStripeCustomer(company: Company) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
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
  const supabase = await createClient();
  await supabase
    .from("companies")
    .update({
      stripe_customer_id: customer.id,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", company.id);

  return customer;
}

export async function syncStripeCustomers() {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables."
    );
  }

  const supabase = await createClient();

  try {
    // Get all companies without Stripe IDs first
    const { data: companiesWithoutStripe } = await supabase
      .from("companies")
      .select("*")
      .is("stripe_customer_id", null);

    // Create Stripe customers for companies that don't have one
    if (companiesWithoutStripe) {
      for (const company of companiesWithoutStripe) {
        await createStripeCustomer(company);
      }
    }

    // Get all Stripe customers
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ["data.subscriptions"],
    });

    let syncedCount = 0;
    let createdCount = 0;

    for (const customer of customers.data) {
      const subscription = customer.subscriptions?.data[0];

      // Get default payment method if available
      let paymentMethod: Stripe.PaymentMethod | null = null;
      if (customer.default_source) {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customer.id,
          type: "card",
        });
        paymentMethod = paymentMethods.data[0];
      }

      // Find company by Stripe customer ID
      const { data: existingCompany } = await supabase
        .from("companies")
        .select()
        .eq("stripe_customer_id", customer.id)
        .single();

      const companyData = {
        name: customer.name || customer.description || "Unknown Company",
        contact_email: customer.email || "",
        contact_phone: customer.phone || "",
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription?.id || null,
        stripe_payment_method_id: paymentMethod?.id || null,
        subscription_amount:
          subscription?.items.data[0]?.price.unit_amount || 0,
        last_synced_at: new Date().toISOString(),
        status: "active",
      };

      if (existingCompany) {
        // Update existing company
        await supabase
          .from("companies")
          .update(companyData)
          .eq("id", existingCompany.id);
        syncedCount++;
      } else {
        // Create new company from Stripe customer
        // Extract first and last name from customer name or description
        const nameParts = (customer.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        await supabase.from("companies").insert({
          ...companyData,
          contact_first_name: firstName,
          contact_last_name: lastName,
        });
        createdCount++;
      }
    }

    revalidatePath("/Companies");
    return {
      success: true,
      message: `Synced ${syncedCount} and created ${createdCount} companies from Stripe`,
    };
  } catch (error) {
    console.error("Error syncing Stripe customers:", error);
    throw error;
  }
}

export async function updateCompanyInStripe(company: Company) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    if (!company.stripe_customer_id) {
      // If company doesn't have a Stripe ID, create a new customer
      await createStripeCustomer(company);
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

export async function syncStripeCustomer(companyId: number) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  try {
    const { data: company } = await supabase
      .from("companies")
      .select()
      .eq("id", companyId)
      .single();

    if (!company) {
      throw new Error("Company not found");
    }

    let customer: Stripe.Customer;

    if (!company.stripe_customer_id) {
      // Create new customer in Stripe
      customer = await createStripeCustomer(company);
    } else {
      try {
        // Try to get existing Stripe customer
        const stripeCustomer = await stripe.customers.retrieve(
          company.stripe_customer_id,
          {
            expand: ["subscriptions"],
          }
        );

        if (stripeCustomer.deleted) {
          // If customer was deleted in Stripe, create a new one
          customer = await createStripeCustomer(company);
        } else {
          customer = stripeCustomer as Stripe.Customer;
          // Update customer data in Stripe to match our database
          await updateCompanyInStripe(company);
        }
      } catch (error) {
        // If customer doesn't exist in Stripe, create a new one
        customer = await createStripeCustomer(company);
      }
    }

    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: "card",
    });

    const subscription = customer.subscriptions?.data[0];
    const paymentMethod = paymentMethods.data[0];

    // Update company with latest Stripe data
    await supabase
      .from("companies")
      .update({
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription?.id || null,
        stripe_payment_method_id: paymentMethod?.id || null,
        subscription_amount:
          subscription?.items.data[0]?.price.unit_amount || 0,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    revalidatePath("/Companies");
    return { success: true, message: "Customer synced successfully" };
  } catch (error) {
    console.error("Error syncing Stripe customer:", error);
    throw error;
  }
}

interface StripeCharge {
  amount: number;
  description: string;
  metadata?: Record<string, string>;
}

export async function createInvoiceItem(
  companyId: number,
  charge: StripeCharge
): Promise<Response> {
  const response = await fetch(`/api/companies/${companyId}/invoice-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(charge),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || "Failed to create invoice item");
  }

  return response;
}

export async function createInvoice(
  companyId: number,
  autoCharge: boolean = false
): Promise<Response> {
  const response = await fetch(`/api/companies/${companyId}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ auto_charge: autoCharge }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || "Failed to create invoice");
  }

  return response;
}

// Function to add charges and optionally create an invoice
export async function addCharges(
  company: Company,
  charges: StripeCharge[]
): Promise<void> {
  if (!company.stripe_customer_id) {
    throw new Error("Company is not connected to Stripe");
  }

  // Add all charges as invoice items
  for (const charge of charges) {
    await createInvoiceItem(company.id, charge);
  }

  // If auto_invoice is enabled, create and finalize the invoice immediately
  if (company.auto_invoice) {
    await createInvoice(company.id, true); // true for auto-charge
  }
}

export async function deleteCompanyFromStripe(company: Company): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  if (!company.stripe_customer_id) {
    return; // Nothing to delete in Stripe
  }

  try {
    // Check for active subscriptions
    const customer = await stripe.customers.retrieve(
      company.stripe_customer_id,
      {
        expand: ["subscriptions"],
      }
    );

    if ((customer as Stripe.Customer).subscriptions?.data.length) {
      throw new Error("Cannot delete company with active subscriptions");
    }

    // Delete the customer in Stripe
    await stripe.customers.del(company.stripe_customer_id);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to delete customer in Stripe");
  }
}

export async function getStripeSubscriptionDetails(companyId: number) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();

  // Get company details
  const { data: company } = await supabase
    .from("companies")
    .select()
    .eq("id", companyId)
    .single();

  if (!company || !company.stripe_customer_id) {
    throw new Error("Company not found or not connected to Stripe");
  }

  try {
    // Get customer with expanded payment method
    const customer = await stripe.customers.retrieve(
      company.stripe_customer_id,
      {
        expand: ["invoice_settings.default_payment_method"],
      }
    );

    if (!("invoice_settings" in customer)) {
      throw new Error("Invalid customer object returned from Stripe");
    }

    // Get subscription details separately
    let subscription = null;
    let upcomingInvoice = null;
    const subscriptions = await stripe.subscriptions.list({
      customer: company.stripe_customer_id,
      limit: 1,
      status: "all",
      expand: ["data.items.data.price"],
    });

    if (subscriptions.data.length > 0) {
      subscription = subscriptions.data[0];
      // Fetch upcoming invoice for the subscription
      try {
        upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          customer: company.stripe_customer_id,
          subscription: subscription.id,
        });
      } catch (error) {
        console.error("Error fetching upcoming invoice:", error);
      }
      // Fetch product details separately for each price
      const items = await Promise.all(
        subscription.items.data.map(async (item) => {
          const price = await stripe.prices.retrieve(item.price.id, {
            expand: ["product"],
          });
          return {
            id: item.id,
            price: {
              id: price.id,
              unit_amount: price.unit_amount,
              currency: price.currency,
              nickname:
                price.nickname || (price.product as Stripe.Product).name,
              product: {
                id: (price.product as Stripe.Product).id,
                name: (price.product as Stripe.Product).name,
              },
            },
            quantity: item.quantity,
          };
        })
      );
      subscription.items.data = items;
    }

    // Get recent invoices
    const invoices = await stripe.invoices.list({
      customer: company.stripe_customer_id,
      limit: 5,
      status: "paid",
    });

    // Get all payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: company.stripe_customer_id,
      type: "card",
    });

    // Serialize the data to plain objects
    const serializedData = {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        invoice_settings: {
          default_payment_method:
            customer.invoice_settings?.default_payment_method?.id ||
            customer.invoice_settings?.default_payment_method ||
            null,
        },
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            items: subscription.items.data.map((item: any) => ({
              id: item.id,
              price: {
                id: item.price.id,
                unit_amount: item.price.unit_amount,
                currency: item.currency || "usd",
                nickname: item.price.nickname || item.price.product?.name,
                product: {
                  id: item.price.product?.id,
                  name: item.price.product?.name || "Unknown Product",
                },
              },
              quantity: item.quantity,
            })),
          }
        : null,
      upcoming_invoice: upcomingInvoice
        ? {
            amount_due: upcomingInvoice.amount_due,
            created: upcomingInvoice.created,
            period_end: upcomingInvoice.period_end,
            period_start: upcomingInvoice.period_start,
          }
        : null,
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        amount_due: invoice.amount_due,
        status: invoice.status,
        created: invoice.created,
      })),
      paymentMethods: paymentMethods.data.map((method) => ({
        id: method.id,
        type: method.type,
        card: {
          brand: method.card?.brand,
          last4: method.card?.last4,
          exp_month: method.card?.exp_month,
          exp_year: method.card?.exp_year,
        },
      })),
    };

    console.log("Stripe data serialized:", {
      customerId: company.stripe_customer_id,
      defaultPaymentMethod:
        serializedData.customer.invoice_settings.default_payment_method,
      paymentMethodsCount: serializedData.paymentMethods.length,
      subscriptionStatus: serializedData.subscription?.status,
    });

    return serializedData;
  } catch (error) {
    console.error("Error fetching Stripe details:", error);
    throw error;
  }
}

interface UpdateSubscriptionQuantityParams {
  subscriptionId: string;
  itemId: string;
  quantity: number;
}

export async function updateSubscriptionQuantity({
  subscriptionId,
  itemId,
  quantity,
}: UpdateSubscriptionQuantityParams) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, quantity }],
    });

    return {
      success: true,
      message: "Subscription quantity updated successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error updating subscription quantity:", error);
    throw error;
  }
}

interface ChangeSubscriptionPlanParams {
  subscriptionId: string;
  itemId: string;
  newPriceId: string;
}

export async function changeSubscriptionPlan({
  subscriptionId,
  itemId,
  newPriceId,
}: ChangeSubscriptionPlanParams) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "always_invoice",
    });

    return {
      success: true,
      message: "Subscription plan changed successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error changing subscription plan:", error);
    throw error;
  }
}

export async function getAvailablePlans() {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    // First, get all active products
    const products = await stripe.products.list({
      active: true,
    });

    // Then get prices for active products only
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      type: "recurring",
    });

    // Filter prices to only include those with active products
    const activeProductIds = new Set(
      products.data.map((product) => product.id)
    );
    const activePrices = prices.data.filter((price) =>
      activeProductIds.has((price.product as Stripe.Product).id)
    );

    return {
      success: true,
      plans: JSON.parse(JSON.stringify(activePrices)),
    };
  } catch (error) {
    console.error("Error fetching available plans:", error);
    throw error;
  }
}

interface AddSubscriptionItemParams {
  subscriptionId: string;
  priceId: string;
  quantity?: number;
  metadata?: Record<string, string>;
}

export async function addSubscriptionItem({
  subscriptionId,
  priceId,
  quantity,
  metadata,
}: AddSubscriptionItemParams) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscriptionItem = await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: priceId,
      quantity: quantity || 1,
      metadata,
    });

    return {
      success: true,
      message: "Subscription item added successfully",
      subscriptionItem: JSON.parse(JSON.stringify(subscriptionItem)),
    };
  } catch (error) {
    console.error("Error adding subscription item:", error);
    throw error;
  }
}

export async function getCompanyPaymentMethods(companyId: number) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Try to get payment methods from cache first
  const cachedPaymentMethods = await getCachedPaymentMethods(companyId);
  if (cachedPaymentMethods) {
    return cachedPaymentMethods;
  }

  // If not in cache, fetch from Stripe
  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .single();

  if (error || !company?.stripe_customer_id) {
    throw new Error("Company not found or not connected to Stripe");
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: company.stripe_customer_id,
    type: "card",
  });

  // Cache the payment methods
  await cachePaymentMethods(companyId, paymentMethods.data);

  return paymentMethods.data;
}

export async function addPaymentMethod(
  companyId: number,
  paymentMethodId: string
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .single();

  if (error || !company?.stripe_customer_id) {
    throw new Error("Company not found or not connected to Stripe");
  }

  // Attach the payment method to the customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: company.stripe_customer_id,
  });

  // Set as default payment method if it's the first one
  const paymentMethods = await stripe.paymentMethods.list({
    customer: company.stripe_customer_id,
    type: "card",
  });

  if (paymentMethods.data.length === 1) {
    await stripe.customers.update(company.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  return paymentMethods.data;
}

export async function removePaymentMethod(
  companyId: number,
  paymentMethodId: string
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .single();

  if (error || !company?.stripe_customer_id) {
    throw new Error("Company not found or not connected to Stripe");
  }

  // Detach the payment method
  await stripe.paymentMethods.detach(paymentMethodId);

  // Return updated list of payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: company.stripe_customer_id,
    type: "card",
  });

  return paymentMethods.data;
}

export async function setDefaultPaymentMethod(
  companyId: number,
  paymentMethodId: string
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .single();

  if (error || !company?.stripe_customer_id) {
    throw new Error("Company not found or not connected to Stripe");
  }

  // Set as default payment method
  await stripe.customers.update(company.stripe_customer_id, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // Return updated list of payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: company.stripe_customer_id,
    type: "card",
  });

  return paymentMethods.data;
}

interface CreateSubscriptionParams {
  customerId: string;
  items: Array<{
    price: string;
    quantity: number;
  }>;
  metadata?: Record<string, string>;
}

export async function createSubscription({
  customerId,
  items,
  metadata,
}: CreateSubscriptionParams) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    // First, get the customer to check for default payment method
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    if (
      !("invoice_settings" in customer) ||
      !customer.invoice_settings.default_payment_method ||
      typeof customer.invoice_settings.default_payment_method === "string"
    ) {
      throw new Error(
        "No default payment method found. Please add a payment method first."
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: items,
      metadata,
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice"],
    });

    return {
      success: true,
      message: "Subscription created successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    return {
      success: true,
      message: "Subscription cancelled successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    throw error;
  }
}

export async function pauseSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      pause_collection: {
        behavior: "mark_uncollectible",
      },
    });

    return {
      success: true,
      message: "Subscription paused successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error pausing subscription:", error);
    throw error;
  }
}

export async function resumeSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      pause_collection: null,
    });

    return {
      success: true,
      message: "Subscription resumed successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error resuming subscription:", error);
    throw error;
  }
}
