import { createClient } from "@/utils/supabase/client";
import { prefetchData } from "@/lib/prefetch-data";

export async function signIn(email: string, password: string) {
  try {
    const supabase = createClient();

    // Sign in the user
    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      throw signInError;
    }

    if (!authData.user) {
      throw new Error("No user data returned after sign in");
    }

    // Get the user's role from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user role:", profileError);
      throw profileError;
    }

    if (!profileData?.role) {
      console.error("No role found for user");
      throw new Error("User role not found");
    }

    // Start prefetching data with both role and userId
    console.log(
      "Starting data prefetch with role:",
      profileData.role,
      "userId:",
      authData.user.id
    );
    await prefetchData(profileData.role, authData.user.id);

    return { user: authData.user, role: profileData.role };
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
