"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Company } from "./types";
import { revalidatePath } from "next/cache";
import {
  updateCompanyInStripe,
  deleteCompanyFromStripe,
} from "./stripe-actions";

export async function getCompaniesAction(): Promise<Company[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return companies;
}

export async function createCompanyAction(
  companyData: Partial<Company>
): Promise<Company> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...companyData,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/Companies");
  return data;
}

export async function updateCompanyAction(
  id: number,
  companyData: Partial<Company>
): Promise<Company> {
  const supabase = await createClient();

  // First, get the current company data
  const { data: existingCompany, error: fetchError } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  // Update in database
  const { data, error } = await supabase
    .from("companies")
    .update(companyData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If company has Stripe connection and relevant fields were updated, sync with Stripe
  if (data.stripe_customer_id) {
    const relevantFields = [
      "name",
      "contact_email",
      "contact_phone",
      "contact_first_name",
      "contact_last_name",
      "status",
    ];

    const hasRelevantChanges = Object.keys(companyData).some(
      (key) =>
        relevantFields.includes(key) &&
        companyData[key as keyof Company] !==
          existingCompany[key as keyof Company]
    );

    if (hasRelevantChanges) {
      try {
        await updateCompanyInStripe(data);
      } catch (stripeError) {
        console.error("Failed to sync company with Stripe:", stripeError);
        // We might want to notify the user but not fail the operation
      }
    }
  }

  revalidatePath("/Companies");
  return data;
}

export async function deleteCompanyAction(id: number): Promise<void> {
  const supabase = await createClient();

  // First, get the company data
  const { data: company, error: fetchError } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (!company) throw new Error("Company not found");

  let stripeError: Error | null = null;

  // Try to delete from Stripe if connected
  if (company.stripe_customer_id) {
    try {
      await deleteCompanyFromStripe(company);
    } catch (error) {
      // Store the error but continue with database deletion
      stripeError =
        error instanceof Error
          ? error
          : new Error("Failed to delete customer in Stripe");

      // Only throw if it's an active subscription error
      if (
        error instanceof Error &&
        error.message === "Cannot delete company with active subscriptions"
      ) {
        throw error;
      }
      // Log the error but continue with database deletion
      console.error("Error deleting from Stripe:", error);
    }
  }

  // Delete from database regardless of Stripe status
  const { error: dbError } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .single();

  if (dbError) {
    console.error("Database deletion error:", dbError);
    throw new Error(
      `Failed to delete company from database: ${dbError.message}`
    );
  }

  revalidatePath("/Companies");

  // If there was a Stripe error but database deletion succeeded,
  // throw a warning that indicates partial deletion
  if (
    stripeError &&
    stripeError.message !== "Cannot delete company with active subscriptions"
  ) {
    throw new Error(
      "Company deleted from database but failed to delete from Stripe. Please try syncing with Stripe."
    );
  }
}
