"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  try {
    const supabase = await createClient();

    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { users: [], error: "Failed to fetch users" };
  }
}

export async function createUser(formData: FormData) {
  try {
    const supabase = await createClient();

    const { data: user, error } = await supabase.auth.signUp({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      options: {
        data: {
          first_name: formData.get("first_name"),
          last_name: formData.get("last_name"),
          phone_number: formData.get("phone_number"),
          role: formData.get("role"),
          status: "pending",
          dob: formData.get("dob"),
        },
      },
    });

    if (error) throw error;

    revalidatePath("/Users");
    return { user, error: null };
  } catch (error) {
    console.error("Error creating user:", error);
    return { user: null, error: "Failed to create user" };
  }
}

export async function updateUser(formData: FormData) {
  try {
    const supabase = await createClient();
    const userId = formData.get("id") as string;

    const { data: user, error } = await supabase
      .from("users")
      .update({
        first_name: formData.get("first_name"),
        last_name: formData.get("last_name"),
        phone_number: formData.get("phone_number"),
        role: formData.get("role"),
        dob: formData.get("dob"),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    return { user, error: null };
  } catch (error) {
    console.error("Error updating user:", error);
    return { user: null, error: "Failed to update user" };
  }
}

export async function updateUserStatus(userId: string, status: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { user: data, error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}
