import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { invalidatePaymentMethodsCache } from "@/lib/redis";

// Add debug logging for environment variables
console.log("Environment Check:", {
  hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  stripeKeyLength: process.env.STRIPE_SECRET_KEY?.length,
});

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Supabase admin client without cookie handling
const supabaseAdmin =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : null;

interface WebhookError extends Error {
  type?: string;
  code?: string;
  decline_code?: string;
  param?: string;
}

// This route will handle both /webhook and /api/webhooks/stripe paths
export async function POST(req: Request) {
  console.log("Webhook request received");

  // Check if Stripe is initialized
  if (!stripe) {
    console.error("Stripe API key is not configured");
    return new NextResponse("Stripe API key is not configured", {
      status: 500,
    });
  }

  // Check if webhook secret is initialized
  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured");
    return new NextResponse("Stripe webhook secret is not configured", {
      status: 500,
    });
  }

  try {
    // Verify Stripe API key is working
    try {
      await stripe.customers.list({ limit: 1 });
      console.log("Stripe API key verified successfully");
    } catch (error) {
      console.error("Failed to verify Stripe API key:", error);
      return new NextResponse("Invalid Stripe configuration", { status: 500 });
    }

    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    console.log("Webhook headers:", {
      signature: signature?.substring(0, 10) + "...",
      contentType: headersList.get("content-type"),
      contentLength: headersList.get("content-length"),
    });

    if (!signature) {
      console.error("No Stripe signature found");
      return new NextResponse("No signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log("Event constructed successfully:", {
        type: event.type,
        id: event.id,
        apiVersion: event.api_version,
        object: event.data.object,
      });
    } catch (err: any) {
      console.error("Webhook signature verification failed:", {
        error: err,
        message: err.message,
        stack: err.stack,
      });
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log("Processing Stripe event:", event.type);

    try {
      let updated = false;
      let result;

      switch (event.type) {
        case "customer.created":
        case "customer.updated":
          try {
            const customer = event.data.object as Stripe.Customer;
            console.log("Processing customer event:", {
              type: event.type,
              customerId: customer.id,
              customerEmail: customer.email,
              customerName: customer.name,
              metadata: customer.metadata,
              defaultSource: customer.default_source,
              defaultPaymentMethod:
                customer.invoice_settings?.default_payment_method,
            });
            result = await handleCustomerUpdate(customer, stripe);
            updated = true;
          } catch (error: unknown) {
            console.error("Error in customer event handler:", {
              error,
              type: event.type,
              stack: error instanceof Error ? error.stack : undefined,
              data: event.data.object,
            });
            // Don't throw, return error response
            return new NextResponse(
              JSON.stringify({
                error: "Error processing customer event",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500 }
            );
          }
          break;

        case "invoice.created":
        case "invoice.paid":
        case "invoice.payment_failed":
        case "invoice.finalized":
          try {
            const invoice = event.data.object as Stripe.Invoice;
            console.log("Processing invoice event:", {
              type: event.type,
              invoiceId: invoice.id,
              customerId: invoice.customer,
              status: invoice.status,
            });
            result = await handleInvoiceUpdate(invoice, stripe);
            updated = true;
          } catch (error: unknown) {
            console.error("Error in invoice event handler:", {
              error,
              type: event.type,
              stack: error instanceof Error ? error.stack : undefined,
              data: event.data.object,
            });
            // Don't throw, return error response
            return new NextResponse(
              JSON.stringify({
                error: "Error processing invoice event",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500 }
            );
          }
          break;

        case "customer.subscription.updated":
        case "customer.subscription.created":
        case "customer.subscription.deleted":
          try {
            const subscription = event.data.object as Stripe.Subscription;
            console.log("Processing subscription event:", {
              type: event.type,
              subscriptionId: subscription.id,
              customerId: subscription.customer,
            });
            result = await handleSubscriptionUpdate(subscription, stripe);
            updated = true;
          } catch (error: unknown) {
            console.error("Error in subscription event handler:", {
              error,
              type: event.type,
              stack: error instanceof Error ? error.stack : undefined,
              data: event.data.object,
            });
            // Don't throw, return error response
            return new NextResponse(
              JSON.stringify({
                error: "Error processing subscription event",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500 }
            );
          }
          break;

        case "payment_method.attached":
        case "payment_method.updated":
        case "payment_method.detached":
          try {
            const paymentMethod = event.data.object as Stripe.PaymentMethod;
            console.log("Processing payment method event:", {
              type: event.type,
              paymentMethodId: paymentMethod.id,
              customerId: paymentMethod.customer,
            });
            result = await handlePaymentMethodUpdate(paymentMethod, stripe);
            updated = true;
          } catch (error: unknown) {
            console.error("Error in payment method event handler:", {
              error,
              type: event.type,
              stack: error instanceof Error ? error.stack : undefined,
              data: event.data.object,
            });
            // Don't throw, return error response
            return new NextResponse(
              JSON.stringify({
                error: "Error processing payment method event",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500 }
            );
          }
          break;

        default:
          console.log(`🤷‍♂️ Unhandled event type: ${event.type}`);
      }

      // If we updated anything, revalidate the Companies page
      if (updated) {
        try {
          revalidatePath("/Companies");
          console.log("Successfully revalidated Companies page");
        } catch (error: unknown) {
          console.error("Error revalidating path:", {
            error,
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }

      // Handle payment method events
      if (
        event.type === "payment_method.attached" ||
        event.type === "payment_method.detached" ||
        event.type === "customer.updated" // This covers default payment method changes
      ) {
        let customerId: string | null = null;

        if (event.type === "customer.updated") {
          const customer = event.data.object as Stripe.Customer;
          customerId = customer.id;
        } else {
          const paymentMethod = event.data.object as Stripe.PaymentMethod;
          customerId =
            typeof paymentMethod.customer === "string"
              ? paymentMethod.customer
              : null;
        }

        if (!customerId) {
          console.error("No customer ID found in webhook event");
          return new NextResponse("No customer ID found", { status: 400 });
        }

        // Get company ID from customer ID
        const { data: company } = await supabaseAdmin
          ?.from("companies")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (company) {
          // Invalidate the cache for this company
          await invalidatePaymentMethodsCache(company.id);
        }
      }

      return NextResponse.json({
        received: true,
        type: event.type,
        updated,
        result,
      });
    } catch (error: unknown) {
      console.error("Error processing event:", {
        error,
        type: event.type,
        stack: error instanceof Error ? error.stack : undefined,
        data: event.data.object,
      });
      return new NextResponse(
        JSON.stringify({
          error: "Error processing webhook event",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Fatal error in webhook handler:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new NextResponse(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}

async function handleCustomerUpdate(
  customer: Stripe.Customer,
  stripeInstance: Stripe | null
) {
  console.log("Starting handleCustomerUpdate for customer:", {
    customerId: customer.id,
    customerEmail: customer.email,
    customerName: customer.name,
    metadata: customer.metadata,
    defaultSource: customer.default_source,
    defaultPaymentMethod: customer.invoice_settings?.default_payment_method,
  });

  try {
    // First, get the latest customer data from Stripe
    const stripeCustomer = await stripeInstance?.customers.retrieve(
      customer.id,
      {
        expand: ["subscriptions", "invoice_settings.default_payment_method"],
      }
    );

    if (stripeCustomer.deleted) {
      console.log("Customer was deleted in Stripe:", customer.id);
      return;
    }

    console.log("Retrieved latest Stripe customer data:", {
      customerId: stripeCustomer.id,
      email: stripeCustomer.email,
      name: stripeCustomer.name,
      metadata: stripeCustomer.metadata,
      hasSubscription: !!stripeCustomer.subscriptions?.data.length,
      hasDefaultPayment:
        !!stripeCustomer.invoice_settings?.default_payment_method,
    });

    // First, try to find ALL companies that might match this customer
    const { data: possibleMatches, error: searchError } = await supabaseAdmin
      ?.from("companies")
      .select()
      .or(
        `stripe_customer_id.eq.${stripeCustomer.id},contact_email.eq.${stripeCustomer.email}${stripeCustomer.name ? `,name.eq.${stripeCustomer.name}` : ""}`
      );

    console.log("Found possible matching companies:", {
      count: possibleMatches?.length || 0,
      matches: possibleMatches?.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.contact_email,
        stripeId: c.stripe_customer_id,
      })),
    });

    let company = null;

    // If we found any matches, determine the best one
    if (possibleMatches?.length) {
      // First priority: exact Stripe customer ID match
      company = possibleMatches.find(
        (c) => c.stripe_customer_id === stripeCustomer.id
      );

      if (company) {
        console.log("Found exact match by Stripe customer ID:", company.id);
      } else {
        // Second priority: email match without any Stripe ID
        company = possibleMatches.find(
          (c) =>
            c.contact_email === stripeCustomer.email && !c.stripe_customer_id
        );

        if (company) {
          console.log(
            "Found match by email (without existing Stripe ID):",
            company.id
          );
        } else {
          // Third priority: name match without any Stripe ID
          company = possibleMatches.find(
            (c) => c.name === stripeCustomer.name && !c.stripe_customer_id
          );

          if (company) {
            console.log(
              "Found match by name (without existing Stripe ID):",
              company.id
            );
          }
        }
      }
    }

    if (company) {
      // Update existing company with latest Stripe data
      console.log("Updating existing company with Stripe data:", {
        companyId: company.id,
        stripeCustomerId: stripeCustomer.id,
        currentEmail: company.contact_email,
        newEmail: stripeCustomer.email,
        currentName: company.name,
        newName: stripeCustomer.name,
      });

      const updateData = {
        stripe_customer_id: stripeCustomer.id,
        name: stripeCustomer.name || company.name,
        contact_email: stripeCustomer.email || company.contact_email,
        contact_phone: stripeCustomer.phone || company.contact_phone,
        stripe_subscription_id:
          stripeCustomer.subscriptions?.data[0]?.id || null,
        subscription_amount:
          stripeCustomer.subscriptions?.data[0]?.items.data[0]?.price
            .unit_amount || 0,
        stripe_payment_method_id:
          typeof stripeCustomer.invoice_settings?.default_payment_method ===
          "string"
            ? stripeCustomer.invoice_settings.default_payment_method
            : stripeCustomer.invoice_settings?.default_payment_method?.id ||
              null,
        last_synced_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabaseAdmin
        ?.from("companies")
        .update(updateData)
        .eq("id", company.id);

      if (updateError) {
        console.error("Error updating company:", updateError);
        throw updateError;
      }

      console.log("Successfully updated company with Stripe data:", {
        companyId: company.id,
        stripeCustomerId: stripeCustomer.id,
        updateData,
      });

      return company;
    }

    // If we reach here, we truly need to create a new company
    console.log(
      "No matching company found, creating new company from Stripe customer:",
      {
        customerId: stripeCustomer.id,
        email: stripeCustomer.email,
        name: stripeCustomer.name,
      }
    );

    const nameParts = (stripeCustomer.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const { data: newCompany, error: createError } = await supabaseAdmin
      ?.from("companies")
      .insert({
        name: stripeCustomer.name || "Unknown Company",
        contact_first_name: firstName,
        contact_last_name: lastName,
        contact_email: stripeCustomer.email || "",
        contact_phone: stripeCustomer.phone || "",
        stripe_customer_id: stripeCustomer.id,
        stripe_subscription_id:
          stripeCustomer.subscriptions?.data[0]?.id || null,
        subscription_amount:
          stripeCustomer.subscriptions?.data[0]?.items.data[0]?.price
            .unit_amount || 0,
        stripe_payment_method_id:
          typeof stripeCustomer.invoice_settings?.default_payment_method ===
          "string"
            ? stripeCustomer.invoice_settings.default_payment_method
            : stripeCustomer.invoice_settings?.default_payment_method?.id ||
              null,
        status: "active",
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (createError) {
      console.error("Error creating new company:", createError);
      throw createError;
    }

    if (!newCompany) {
      throw new Error("Failed to create new company - no data returned");
    }

    console.log("Successfully created new company from Stripe data:", {
      companyId: newCompany.id,
      stripeCustomerId: stripeCustomer.id,
      name: newCompany.name,
      email: newCompany.contact_email,
    });

    return newCompany;
  } catch (error) {
    console.error("Error in handleCustomerUpdate:", {
      error,
      customerId: customer.id,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  stripeInstance: Stripe | null
) {
  console.log("Starting handleSubscriptionUpdate for subscription:", {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  try {
    // Find company by customer ID
    const { data: company, error: findError } = await supabaseAdmin
      ?.from("companies")
      .select()
      .eq("stripe_customer_id", subscription.customer)
      .maybeSingle();

    if (findError) {
      console.error("Error finding company for subscription:", findError);
      throw findError;
    }

    if (!company) {
      console.log(`⚠️ No company found for subscription ${subscription.id}`);
      return;
    }

    console.log("Updating subscription for company:", {
      companyId: company.id,
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    // Update subscription details
    const { error: updateError } = await supabaseAdmin
      ?.from("companies")
      .update({
        stripe_subscription_id: subscription.id,
        subscription_amount: subscription.items.data.reduce(
          (total: number, item: Stripe.SubscriptionItem) => {
            return (
              total + (item.price?.unit_amount || 0) * (item.quantity || 1)
            );
          },
          0
        ),
        subscription_status: subscription.status,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (updateError) {
      console.error("Error updating subscription:", updateError);
      throw updateError;
    }

    // If subscription is canceled or inactive, update invoice status
    if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid"
    ) {
      const { error: invoiceUpdateError } = await supabaseAdmin
        ?.from("companies")
        .update({
          last_invoice_status: "void",
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (invoiceUpdateError) {
        console.error("Error updating invoice status:", invoiceUpdateError);
        throw invoiceUpdateError;
      }
    }

    console.log("Successfully updated subscription for company:", {
      companyId: company.id,
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    return company;
  } catch (error) {
    console.error("Error in handleSubscriptionUpdate:", {
      error,
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function handlePaymentMethodUpdate(
  paymentMethod: Stripe.PaymentMethod,
  stripeInstance: Stripe | null
) {
  if (!paymentMethod.customer) {
    console.log(
      "No customer associated with payment method:",
      paymentMethod.id
    );
    return;
  }

  console.log("Starting handlePaymentMethodUpdate:", {
    paymentMethodId: paymentMethod.id,
    customerId: paymentMethod.customer,
  });

  try {
    // Find company by customer ID
    const { data: company, error: findError } = await supabaseAdmin
      ?.from("companies")
      .select()
      .eq("stripe_customer_id", paymentMethod.customer)
      .maybeSingle();

    if (findError) {
      console.error("Error finding company for payment method:", findError);
      throw findError;
    }

    if (!company) {
      console.log(`⚠️ No company found for payment method ${paymentMethod.id}`);
      return;
    }

    console.log("Found company for payment method:", {
      companyId: company.id,
      paymentMethodId: paymentMethod.id,
    });

    // Check if this is the default payment method
    const customer = await stripeInstance?.customers.retrieve(
      paymentMethod.customer as string,
      {
        expand: ["invoice_settings.default_payment_method"],
      }
    );

    // Type guard to ensure we have a full customer object
    if ("invoice_settings" in customer) {
      const isDefault =
        customer.invoice_settings?.default_payment_method === paymentMethod.id;

      console.log("Payment method default status:", {
        paymentMethodId: paymentMethod.id,
        isDefault,
      });

      if (isDefault) {
        // Update company's default payment method
        const { error: updateError } = await supabaseAdmin
          ?.from("companies")
          .update({
            stripe_payment_method_id: paymentMethod.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", company.id);

        if (updateError) {
          console.error("Error updating payment method:", updateError);
          throw updateError;
        }

        console.log(
          "Successfully updated default payment method for company:",
          {
            companyId: company.id,
            paymentMethodId: paymentMethod.id,
          }
        );
      }
    }
  } catch (error) {
    console.error("Error in handlePaymentMethodUpdate:", {
      error,
      paymentMethodId: paymentMethod.id,
      customerId: paymentMethod.customer,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function handleInvoiceUpdate(
  invoice: Stripe.Invoice,
  stripeInstance: Stripe | null
) {
  console.log("Starting handleInvoiceUpdate for invoice:", {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    status: invoice.status,
  });

  try {
    // Find company by customer ID
    const { data: company, error: findError } = await supabaseAdmin
      ?.from("companies")
      .select()
      .eq("stripe_customer_id", invoice.customer)
      .maybeSingle();

    if (findError) {
      console.error("Error finding company for invoice:", findError);
      throw findError;
    }

    if (!company) {
      console.log(`⚠️ No company found for invoice ${invoice.id}`);
      return;
    }

    console.log("Updating invoice for company:", {
      companyId: company.id,
      invoiceId: invoice.id,
      status: invoice.status,
    });

    // Update invoice details
    const updateData: {
      last_invoice_date: string;
      last_invoice_status: string | null;
      last_synced_at: string;
      subscription_status?: string;
    } = {
      last_invoice_date: new Date(invoice.created * 1000).toISOString(),
      last_invoice_status: invoice.status,
      last_synced_at: new Date().toISOString(),
    };

    // If invoice is paid, update subscription status to active
    if (invoice.status === "paid" && invoice.subscription) {
      updateData.subscription_status = "active";
    }

    // If invoice is uncollectible or void, update subscription status to past_due
    if (
      (invoice.status === "uncollectible" || invoice.status === "void") &&
      invoice.subscription
    ) {
      updateData.subscription_status = "past_due";
    }

    const { error: updateError } = await supabaseAdmin
      ?.from("companies")
      .update(updateData)
      .eq("id", company.id);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      throw updateError;
    }

    console.log("Successfully updated invoice for company:", {
      companyId: company.id,
      invoiceId: invoice.id,
      status: invoice.status,
      updateData,
    });

    return company;
  } catch (error) {
    console.error("Error in handleInvoiceUpdate:", {
      error,
      invoiceId: invoice.id,
      customerId: invoice.customer,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Add new function to connect individual company to Stripe
export async function connectCompanyToStripe(companyId: number) {
  console.log("Starting company connection to Stripe:", { companyId });

  // Check if Stripe is initialized
  if (!stripe) {
    return {
      success: false,
      message: "Stripe API key is not configured",
    };
  }

  // Check if Supabase is initialized
  if (!supabaseAdmin) {
    return {
      success: false,
      message: "Supabase configuration is missing",
    };
  }

  try {
    // Get company details
    const { data: company, error: findError } = await supabaseAdmin
      .from("companies")
      .select()
      .eq("id", companyId)
      .single();

    if (findError) {
      console.error("Error finding company:", findError);
      throw findError;
    }

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // Check if company already has a Stripe customer
    if (company.stripe_customer_id) {
      try {
        // Verify if the customer exists in Stripe
        const customer = await stripe.customers.retrieve(
          company.stripe_customer_id
        );
        if (!customer.deleted) {
          return {
            success: true,
            message: "Company already connected to Stripe",
            customerId: company.stripe_customer_id,
          };
        }
      } catch (error) {
        // If customer doesn't exist in Stripe, we'll create a new one
        console.log("Existing Stripe customer not found, will create new one");
      }
    }

    // Create new customer in Stripe
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.contact_email,
      phone: company.contact_phone,
      metadata: {
        company_id: company.id.toString(),
      },
    });

    console.log("Created new Stripe customer:", {
      companyId: company.id,
      customerId: customer.id,
    });

    // Update company with Stripe customer ID
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        stripe_customer_id: customer.id,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (updateError) {
      console.error("Error updating company with Stripe ID:", updateError);
      throw updateError;
    }

    return {
      success: true,
      message: "Successfully connected company to Stripe",
      customerId: customer.id,
    };
  } catch (error) {
    console.error("Error connecting company to Stripe:", {
      error,
      companyId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
