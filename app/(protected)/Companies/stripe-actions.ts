"use server";

import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Company } from "./types";
import { revalidatePath } from "next/cache";
import {
  getCachedPaymentMethods,
  cachePaymentMethods,
  getCachedStripeData,
  cacheStripeData,
  invalidateStripeCache,
  getCachedStripePlans,
  cacheStripePlans,
} from "@/lib/redis";

// Initialize Stripe only if the API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    })
  : null;

// Define our own types that match our serialized data structure
interface SerializedPrice {
  id: string;
  unit_amount: number;
  currency: string;
  nickname: string;
  product: {
    id: string;
    name: string;
  };
}

interface SerializedSubscriptionItem {
  id: string;
  price: SerializedPrice;
  quantity: number;
}

interface SerializedSubscription {
  id: string;
  status: string;
  created: number;
  current_period_end: number;
  items: SerializedSubscriptionItem[];
}

interface SerializedCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  invoice_settings: {
    default_payment_method: string | null;
  };
}

interface SerializedInvoice {
  id: string;
  number: string | null;
  amount_due: number;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

interface SerializedPaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string | null;
    last4: string | null;
    exp_month: number | null;
    exp_year: number | null;
  };
}

interface SerializedUpcomingInvoice {
  amount_due: number;
  created: number;
  period_end: number;
  period_start: number;
}

interface SerializedStripeData {
  customer: SerializedCustomer;
  subscription: SerializedSubscription | null;
  upcoming_invoice: SerializedUpcomingInvoice | null;
  invoices: SerializedInvoice[];
  paymentMethods: SerializedPaymentMethod[];
}

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
      expand: [
        "data.subscriptions",
        "data.invoice_settings.default_payment_method",
      ],
    });

    let syncedCount = 0;
    let createdCount = 0;

    for (const customer of customers.data) {
      const subscription = customer.subscriptions?.data[0];

      // Get payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
      });

      // Get the default payment method
      let defaultPaymentMethodId = null;

      // First check if there's a default payment method in the customer's invoice settings
      if (customer.invoice_settings?.default_payment_method) {
        if (
          typeof customer.invoice_settings.default_payment_method === "string"
        ) {
          defaultPaymentMethodId =
            customer.invoice_settings.default_payment_method;
        } else if (
          (customer.invoice_settings.default_payment_method as any)?.id
        ) {
          defaultPaymentMethodId = (
            customer.invoice_settings.default_payment_method as any
          ).id;
        }
      }

      // If no default payment method is set but there are payment methods, use the first one
      if (!defaultPaymentMethodId && paymentMethods.data.length > 0) {
        defaultPaymentMethodId = paymentMethods.data[0].id;
      }

      // Find company by Stripe customer ID
      const { data: existingCompany } = await supabase
        .from("companies")
        .select()
        .eq("stripe_customer_id", customer.id)
        .single();

      // Get subscription status
      let subscriptionStatus = null;
      if (subscription) {
        subscriptionStatus = subscription.status;
      }

      const companyData = {
        name: customer.name || customer.description || "Unknown Company",
        contact_email: customer.email || "",
        contact_phone: customer.phone || "",
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription?.id || null,
        stripe_payment_method_id: defaultPaymentMethodId,
        subscription_amount:
          subscription?.items.data[0]?.price.unit_amount || 0,
        subscription_status: subscriptionStatus,
        last_synced_at: new Date().toISOString(),
        status: "active",
      };

      console.log(`Syncing Stripe customer ${customer.id}:`, {
        name: companyData.name,
        stripe_subscription_id: companyData.stripe_subscription_id,
        stripe_payment_method_id: companyData.stripe_payment_method_id,
        subscription_status: companyData.subscription_status,
        payment_methods_count: paymentMethods.data.length,
      });

      if (existingCompany) {
        // Update existing company
        await supabase
          .from("companies")
          .update(companyData)
          .eq("id", existingCompany.id);

        // If there are invoices, update the last invoice information
        if (subscription) {
          const invoices = await stripe.invoices.list({
            customer: customer.id,
            limit: 1,
          });

          if (invoices.data.length > 0) {
            const invoiceUpdateData = {
              last_invoice_date: new Date(
                invoices.data[0].created * 1000
              ).toISOString(),
              last_invoice_status: invoices.data[0].status,
            };

            await supabase
              .from("companies")
              .update(invoiceUpdateData)
              .eq("id", existingCompany.id);
          }
        }

        // Invalidate cache for this company
        await invalidateStripeCache(existingCompany.id);

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
            expand: [
              "subscriptions",
              "invoice_settings.default_payment_method",
            ],
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

    // Get the default payment method
    let defaultPaymentMethodId = null;

    // First check if there's a default payment method in the customer's invoice settings
    if (customer.invoice_settings?.default_payment_method) {
      if (
        typeof customer.invoice_settings.default_payment_method === "string"
      ) {
        defaultPaymentMethodId =
          customer.invoice_settings.default_payment_method;
      } else if (customer.invoice_settings.default_payment_method?.id) {
        defaultPaymentMethodId =
          customer.invoice_settings.default_payment_method.id;
      }
    }

    // If no default payment method is set but there are payment methods, use the first one
    if (!defaultPaymentMethodId && paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id;
    }

    const subscription = customer.subscriptions?.data[0];

    // Get subscription status
    let subscriptionStatus = null;
    if (subscription) {
      subscriptionStatus = subscription.status;
      console.log(
        `Subscription status for ${company.name}: ${subscriptionStatus}`
      );
    }

    // Update company with latest Stripe data
    const updateData: any = {
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription?.id || null,
      stripe_payment_method_id: defaultPaymentMethodId,
      subscription_amount: subscription?.items.data[0]?.price.unit_amount || 0,
      subscription_status: subscriptionStatus,
      last_synced_at: new Date().toISOString(),
    };

    console.log(`Updating company ${company.name} with Stripe data:`, {
      stripe_customer_id: updateData.stripe_customer_id,
      stripe_subscription_id: updateData.stripe_subscription_id,
      stripe_payment_method_id: updateData.stripe_payment_method_id,
      subscription_status: updateData.subscription_status,
      payment_methods_count: paymentMethods.data.length,
    });

    await supabase.from("companies").update(updateData).eq("id", companyId);

    // If there are invoices, update the last invoice information
    if (subscription) {
      const invoices = await stripe.invoices.list({
        customer: customer.id,
        limit: 1,
      });

      if (invoices.data.length > 0) {
        const invoiceUpdateData = {
          last_invoice_date: new Date(
            invoices.data[0].created * 1000
          ).toISOString(),
          last_invoice_status: invoices.data[0].status,
        };

        console.log(
          `Updating invoice data for ${company.name}:`,
          invoiceUpdateData
        );

        await supabase
          .from("companies")
          .update(invoiceUpdateData)
          .eq("id", companyId);
      }
    }

    // Invalidate cache for this company
    await invalidateStripeCache(companyId);

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

  // Invalidate cache after changes
  await invalidateStripeCache(company.id);
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

  try {
    // Start timing
    const startTime = performance.now();

    // Get company from database
    const { data: company } = await supabase
      .from("companies")
      .select()
      .eq("id", companyId)
      .single();

    if (!company) {
      throw new Error("Company not found");
    }

    if (!company.stripe_customer_id) {
      throw new Error("Company is not connected to Stripe");
    }

    // Check if we have cached data
    const cachedData = await getCachedStripeData(companyId);
    if (cachedData) {
      console.log("Using cached Stripe data for company", companyId);
      return cachedData;
    }

    // Fetch customer from Stripe
    const customer = await stripe.customers.retrieve(
      company.stripe_customer_id,
      {
        expand: ["invoice_settings.default_payment_method"],
      }
    );

    if (customer.deleted) {
      throw new Error("Stripe customer has been deleted");
    }

    // Fetch subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: company.stripe_customer_id,
      status: "all",
      limit: 1,
      expand: ["data.latest_invoice"],
    });

    // Fetch payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: company.stripe_customer_id,
      type: "card",
    });

    // Fetch invoices
    const invoices = await stripe.invoices.list({
      customer: company.stripe_customer_id,
      limit: 10,
    });

    // Fetch upcoming invoice if there's an active subscription
    let upcomingInvoice = null;
    let subscription = null;

    if (subscriptions.data.length > 0) {
      subscription = subscriptions.data[0];

      // Fetch product details in parallel for all subscription items
      if (subscription.items.data.length > 0) {
        const productIds = subscription.items.data
          .filter(
            (item) =>
              item.price?.product && typeof item.price.product === "string"
          )
          .map((item) => item.price.product as string);

        if (productIds.length > 0) {
          try {
            // Fetch all products in a single call if possible
            const products = await stripe.products.list({
              ids: productIds,
            });

            // Create a map for quick lookup
            const productMap = new Map(
              products.data.map((product) => [
                product.id,
                {
                  id: product.id,
                  name: product.name,
                  active: product.active,
                },
              ])
            );

            // Assign product details to each item
            for (const item of subscription.items.data) {
              if (
                item.price?.product &&
                typeof item.price.product === "string"
              ) {
                const productId = item.price.product;
                const productData = productMap.get(productId) || {
                  id: productId,
                  name: "Unknown Product",
                  active: true,
                };

                (item as any).productDetails = productData;
              }
            }
          } catch (error) {
            console.error("Error fetching product details:", error);
          }
        }
      }

      try {
        upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          customer: company.stripe_customer_id,
        });
      } catch (error) {
        console.log("No upcoming invoice available:", error);
      }
    }

    // End timing
    const endTime = performance.now();
    console.log(
      `stripe-data-fetch: ${((endTime - startTime) / 1000).toFixed(3)}s`
    );

    // Get the default payment method
    let defaultPaymentMethodId = null;

    // First check if there's a default payment method in the customer's invoice settings
    if (
      (customer as Stripe.Customer).invoice_settings?.default_payment_method
    ) {
      const defaultPaymentMethod = (customer as Stripe.Customer)
        .invoice_settings.default_payment_method;
      if (typeof defaultPaymentMethod === "string") {
        defaultPaymentMethodId = defaultPaymentMethod;
      } else if ((defaultPaymentMethod as any)?.id) {
        defaultPaymentMethodId = (defaultPaymentMethod as any).id;
      }
    }

    // If no default payment method is set but there are payment methods, use the first one
    if (!defaultPaymentMethodId && paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id;
    }

    // Serialize the data to plain objects
    const serializedData = {
      customer: {
        id: (customer as Stripe.Customer).id,
        email: (customer as Stripe.Customer).email || null,
        name: (customer as Stripe.Customer).name || null,
        phone: (customer as Stripe.Customer).phone || null,
        invoice_settings: {
          default_payment_method: defaultPaymentMethodId,
        },
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            created: subscription.created,
            current_period_end: subscription.current_period_end,
            items: subscription.items.data.map((item) => {
              // Use the product details we fetched separately
              const productDetails = (item as any).productDetails;

              return {
                id: item.id,
                price: {
                  id: item.price.id,
                  unit_amount: item.price.unit_amount || 0,
                  currency: item.price.currency || "usd",
                  product: productDetails
                    ? {
                        id: productDetails.id,
                        name: productDetails.name,
                        active: productDetails.active,
                      }
                    : {
                        id:
                          typeof item.price.product === "string"
                            ? item.price.product
                            : "unknown",
                        name: "Unknown Product",
                        active: true,
                      },
                },
                quantity: item.quantity || 1,
              };
            }),
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
        status: invoice.status || null,
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
      })),
      paymentMethods: paymentMethods.data.map((method) => ({
        id: method.id,
        type: method.type,
        card: {
          brand: method.card?.brand || null,
          last4: method.card?.last4 || null,
          exp_month: method.card?.exp_month || null,
          exp_year: method.card?.exp_year || null,
        },
      })),
      subscription_status: subscription?.status || null,
      last_invoice_date:
        invoices.data.length > 0 ? invoices.data[0].created : null,
      last_invoice_status:
        invoices.data.length > 0 ? invoices.data[0].status : null,
    };

    // Cache the serialized data
    await cacheStripeData(companyId, serializedData);

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

    // Find the company ID from the subscription's customer
    if (subscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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

    // Find the company ID from the subscription's customer
    if (subscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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
    // Try to get plans from cache first
    const cachedPlans = await getCachedStripePlans();
    if (cachedPlans) {
      console.log("Using cached Stripe plans");
      return {
        success: true,
        plans: cachedPlans,
      };
    }

    console.time("stripe-plans-fetch");

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

    console.timeEnd("stripe-plans-fetch");

    const serializedPlans = JSON.parse(JSON.stringify(activePrices));

    // Cache the plans
    await cacheStripePlans(serializedPlans);

    return {
      success: true,
      plans: serializedPlans,
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

    // Get the subscription to find the customer
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Find the company ID from the subscription's customer
    if (subscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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

  // Invalidate caches
  await invalidateStripeCache(companyId);
  await cachePaymentMethods(companyId, paymentMethods.data);

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

  // Invalidate caches
  await invalidateStripeCache(companyId);
  await cachePaymentMethods(companyId, paymentMethods.data);

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

  // Invalidate caches
  await invalidateStripeCache(companyId);
  await cachePaymentMethods(companyId, paymentMethods.data);

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

    // Find the company ID from the customer ID
    const supabase = await createClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (company) {
      await invalidateStripeCache(company.id);
    }

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
    // Get the subscription first to find the customer
    const existingSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    // Find the company ID from the subscription's customer
    if (existingSubscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof existingSubscription.customer === "string"
            ? existingSubscription.customer
            : existingSubscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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
    // Get the subscription first to find the customer
    const existingSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      pause_collection: {
        behavior: "mark_uncollectible",
      },
    });

    // Find the company ID from the subscription's customer
    if (existingSubscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof existingSubscription.customer === "string"
            ? existingSubscription.customer
            : existingSubscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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
    // Get the subscription first to find the customer
    const existingSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      pause_collection: null,
    });

    // Find the company ID from the subscription's customer
    if (existingSubscription.customer) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq(
          "stripe_customer_id",
          typeof existingSubscription.customer === "string"
            ? existingSubscription.customer
            : existingSubscription.customer.id
        )
        .single();

      if (company) {
        await invalidateStripeCache(company.id);
      }
    }

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
