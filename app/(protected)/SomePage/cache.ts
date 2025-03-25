"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function clearSomePageCache() {
  try {
    // Clear any Redis/other cache if you're using it
    // Clear Supabase cache if needed
    const supabase = await createClient();

    // Revalidate the page path
    revalidatePath("/some-page");

    // You might want to revalidate related paths too
    revalidatePath("/api/some-page-data");
  } catch (error) {
    console.error("Error clearing cache:", error);
    throw error;
  }
}
