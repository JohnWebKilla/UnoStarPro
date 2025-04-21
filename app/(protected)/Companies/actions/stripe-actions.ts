"use server";

import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { Company } from "../lib/types";
import { revalidatePath } from "next/cache";

// Initialize Stripe only if the API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      timeout: 10000, // 10 second timeout
      maxNetworkRetries: 3, // Retry network requests up to 3 times
    })
  : null;

// Helper function to handle Stripe API calls with retries
async function retryStripeOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // Only retry on network errors, not validation errors
      if (!error.type || error.type !== "StripeConnectionError") {
        throw error;
      }
      console.warn(
        `Stripe API call failed (attempt ${attempt}/${maxRetries}):`,
        error.message
      );
      if (attempt < maxRetries) {
        // Wait with exponential backoff before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * Math.pow(2, attempt - 1))
        );
      }
    }
  }
  throw lastError;
}

async function createStripeCustomer(company: Company) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Create a new customer in Stripe with retry logic
  const customer = await retryStripeOperation(() =>
    stripe.customers.create({
      name: company.name,
      email: company.contact_email,
      phone: company.contact_phone,
      metadata: {
        company_id: company.id.toString(),
      },
    })
  );

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
        next_invoice_date: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
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
        next_invoice_date: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
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

  try {
    // Get company details
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select()
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    if (!company.stripe_customer_id) {
      return {
        customer: null,
        subscription: null,
        subscriptionItems: [],
        paymentMethod: null,
        invoices: [],
        totalAmount: 0,
        nextBillingDate: "",
        nextInvoiceAmount: 0,
      };
    }

    // Get customer with basic subscription data
    const customer = await retryStripeOperation(() =>
      stripe.customers.retrieve(company.stripe_customer_id, {
        expand: ["subscriptions"],
      })
    );

    if (!customer || customer.deleted) {
      // Update company record to remove Stripe connection
      await supabase
        .from("companies")
        .update({
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_payment_method_id: null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      return {
        customer: null,
        subscription: null,
        subscriptionItems: [],
        paymentMethod: null,
        invoices: [],
        totalAmount: 0,
        nextBillingDate: "",
        nextInvoiceAmount: 0,
      };
    }

    // Get subscription details
    let subscription: Stripe.Subscription | null = null;
    let subscriptionItems: Stripe.SubscriptionItem[] = [];
    let upcomingInvoice: Stripe.Response<Stripe.UpcomingInvoice> | null = null;

    const customerData = customer as Stripe.Customer;
    const subscriptionsData =
      customerData.subscriptions as Stripe.ApiList<Stripe.Subscription>;

    if (subscriptionsData?.data?.[0]?.id) {
      subscription = await retryStripeOperation(() =>
        stripe.subscriptions.retrieve(subscriptionsData.data[0].id, {
          expand: ["items.data.price", "items.data.price.product"],
        })
      );

      if (subscription) {
        subscriptionItems = subscription.items.data;

        // Get upcoming invoice
        try {
          upcomingInvoice = await retryStripeOperation(() =>
            stripe.invoices.retrieveUpcoming({
              customer: company.stripe_customer_id,
            })
          );
        } catch (error) {
          console.error("Error fetching upcoming invoice:", error);
          // Continue without upcoming invoice
        }
      }
    }

    // Calculate totals
    const totalAmount = subscriptionItems.reduce((sum, item) => {
      const unitAmount = item.price?.unit_amount || 0;
      const quantity = item.quantity || 1;
      return sum + unitAmount * quantity;
    }, 0);

    // Return serialized data
    return {
      totalAmount,
      nextBillingDate: subscription?.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : "",
      nextInvoiceAmount: upcomingInvoice?.amount_due || totalAmount,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            plan: subscription.items.data[0]?.price
              ? {
                  id: subscription.items.data[0].price.id,
                  nickname: subscription.items.data[0].price.nickname,
                  product: subscription.items.data[0].price.product,
                }
              : null,
          }
        : null,
      subscriptionItems: subscriptionItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: {
          id: item.price?.id,
          unit_amount: item.price?.unit_amount || 0,
          nickname: item.price?.nickname,
          product: {
            name:
              typeof item.price?.product === "string"
                ? "Unknown Product"
                : (item.price?.product as Stripe.Product)?.name ||
                  "Unknown Product",
          },
        },
      })),
    };
  } catch (error) {
    console.error("Error retrieving Stripe data:", error);
    return {
      customer: null,
      subscription: null,
      subscriptionItems: [],
      paymentMethod: null,
      invoices: [],
      totalAmount: 0,
      nextBillingDate: "",
      nextInvoiceAmount: 0,
    };
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
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      type: "recurring",
    });

    return {
      success: true,
      plans: JSON.parse(JSON.stringify(prices.data)),
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
    // First, get the current subscription to check for existing items
    let currentSubscription;
    try {
      currentSubscription = await stripe.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ["items.data.price", "items.data.price.product"],
        }
      );
    } catch (retrieveError: any) {
      console.error("Error retrieving subscription:", retrieveError);
      throw new Error(
        `Failed to retrieve subscription: ${retrieveError.message || "Unknown error"}`
      );
    }

    // Check if an item with the same price already exists
    const existingItem = currentSubscription.items.data.find(
      (item) => item.price.id === priceId
    );

    if (existingItem) {
      // Get the product name for a more helpful error message
      const product = existingItem.price.product as Stripe.Product;
      const productName = product.name || "This plan";
      throw new Error(
        `${productName} is already added to the subscription. You cannot add the same plan twice.`
      );
    }

    // Add the new item to the subscription
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          price: priceId,
          quantity: quantity || 1,
          metadata: metadata || {},
        },
      ],
      expand: ["items.data.price", "items.data.price.product"],
    });

    return {
      success: true,
      message: "Subscription item added successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error adding subscription item:", error);
    throw error;
  }
}

interface RemoveSubscriptionItemParams {
  subscriptionId: string;
  itemId: string;
}

export async function removeSubscriptionItem({
  subscriptionId,
  itemId,
}: RemoveSubscriptionItemParams) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: itemId,
          deleted: true,
        },
      ],
    });

    return {
      success: true,
      message: "Subscription item removed successfully",
      subscription: JSON.parse(JSON.stringify(subscription)),
    };
  } catch (error) {
    console.error("Error removing subscription item:", error);
    throw error;
  }
}

export async function getUpcomingInvoice(customerId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
    });

    return upcomingInvoice;
  } catch (error) {
    console.error("Error retrieving upcoming invoice:", error);
    throw error;
  }
}

export async function getStripePaymentHistory(customerId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100,
    });

    return paymentIntents.data.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      created: payment.created,
    }));
  } catch (error) {
    console.error("Error fetching payment history:", error);
    throw error;
  }
}

export async function getPaymentMethods(customerId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    return paymentMethods.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand,
      last4: method.card?.last4,
      expMonth: method.card?.exp_month,
      expYear: method.card?.exp_year,
      isDefault: method.metadata?.is_default === "true",
    }));
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    throw error;
  }
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  action:
    | "pause"
    | "cancel"
    | "resume"
    | "update"
    | "share_link"
    | "exclude_auto_cancel"
    | "create_invoice"
    | "dont_cancel"
    | "reschedule_cancel"
    | "cancel_now"
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    let subscription;
    let paymentLink;
    let invoice;

    switch (action) {
      case "pause":
        subscription = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: {
            behavior: "mark_uncollectible",
          },
        });
        break;

      case "resume":
      case "dont_cancel":
        // Resume a paused subscription or cancel a pending cancellation
        subscription = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: "",
          cancel_at_period_end: false,
        });
        break;

      case "cancel":
      case "reschedule_cancel":
        // Schedule cancellation at period end
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        break;

      case "cancel_now":
        // Immediately cancel the subscription
        subscription = await stripe.subscriptions.cancel(subscriptionId);
        break;

      case "update":
        // Retrieve the subscription for update in UI
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["customer", "items.data.price.product"],
        });
        break;

      case "share_link":
        // Create a customer portal session for updating payment details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.customer) {
          const customerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/Companies`,
          });
          return {
            success: true,
            message: "Payment update link created",
            url: session.url,
          };
        }
        break;

      case "exclude_auto_cancel":
        // Update subscription metadata to exclude from auto-cancellation
        subscription = await stripe.subscriptions.update(subscriptionId, {
          metadata: {
            exclude_from_auto_cancellation: "true",
          },
        });
        break;

      case "create_invoice":
        // Create an invoice immediately for the subscription
        const sub2 = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub2.customer) {
          const customerId =
            typeof sub2.customer === "string"
              ? sub2.customer
              : sub2.customer.id;
          invoice = await stripe.invoices.create({
            customer: customerId,
            auto_advance: true, // auto-finalize the invoice
          });

          // Finalize the invoice
          invoice = await stripe.invoices.finalizeInvoice(invoice.id);
        }
        return {
          success: true,
          message: "One-time invoice created successfully",
          invoice: JSON.parse(JSON.stringify(invoice)),
        };
    }

    return {
      success: true,
      message: `Subscription ${action}ed successfully`,
      subscription: subscription
        ? JSON.parse(JSON.stringify(subscription))
        : null,
    };
  } catch (error) {
    console.error(`Error performing subscription action ${action}:`, error);
    throw error;
  }
}

export async function getInvoices(customerId: string) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      expand: ["data.payment_intent"],
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      dueDate: invoice.due_date,
      pdfUrl: invoice.invoice_pdf,
      paymentStatus: (invoice.payment_intent as Stripe.PaymentIntent)?.status,
    }));
  } catch (error) {
    console.error("Error fetching invoices:", error);
    throw error;
  }
}

export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      success: true,
      message: "Default payment method updated successfully",
    };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    throw error;
  }
}
